import { NextRequest, NextResponse } from "next/server";
import {
  canStartDemo,
  canPlayTurn,
  demoOpener,
  demoReplyStream,
  demoDebrief,
  findDemoCase,
  DEMO_MAX_TURNS,
  type DemoMsg,
} from "@/lib/demo-sim";
import { callerIp } from "@/lib/rate-limit";
import { recordInteraction } from "@/lib/funnel";

export const dynamic = "force-dynamic";

// POST /api/demo/turn — démo publique jouable, SANS compte et SANS état serveur.
// Body : { caseId, action: "start" | "reply" | "debrief", history?, message? }
// - action "start"  → JSON  { opener }
// - action "reply"  → text/plain STREAMÉ (réplique du patient au fil de l'eau)
// - action "debrief"→ JSON  { debrief }
// Quand un garde-fou coût refuse (budget/quota/rafale/désactivé) ou en cas d'échec
// LLM, on répond 200 { fallback: true } : le client bascule sur la démo statique.
const FALLBACK = (reason: string) =>
  NextResponse.json({ fallback: true, reason }, { status: 200 });

type Body = {
  caseId?: string;
  action?: string;
  history?: unknown;
  message?: string;
};

function parseHistory(raw: unknown): DemoMsg[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (m): m is DemoMsg =>
        m != null &&
        (m.role === "patient" || m.role === "apprenant") &&
        typeof m.content === "string",
    )
    .slice(-16);
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const caseId = String(body.caseId ?? "");
  const action = String(body.action ?? "");
  if (!findDemoCase(caseId)) {
    return NextResponse.json({ error: "cas inconnu" }, { status: 400 });
  }
  const ip = await callerIp();

  try {
    // --- Démarrage : compte une démo dans le budget global + quota IP ---
    if (action === "start") {
      const guard = await canStartDemo(ip);
      if (!guard.ok) return FALLBACK(guard.reason);
      const opener = await demoOpener(caseId);
      await recordInteraction("demo_started", { meta: { caseId } });
      return NextResponse.json({ opener });
    }

    // Les tours suivants ne sont soumis qu'au contrôle de rafale (déjà comptés au start).
    const guard = await canPlayTurn(ip);
    if (!guard.ok) return FALLBACK(guard.reason);

    // --- Micro-débrief final (gratuit, généré par le LLM) ---
    if (action === "debrief") {
      const history = parseHistory(body.history);
      const debrief = await demoDebrief(caseId, history);
      await recordInteraction("demo_finished", { meta: { caseId } });
      return NextResponse.json({ debrief });
    }

    // --- Un tour de dialogue (réponse streamée) ---
    if (action === "reply") {
      const message = String(body.message ?? "").trim();
      if (!message) return NextResponse.json({ error: "message vide" }, { status: 400 });
      const history = parseHistory(body.history);
      // Borne serveur du nombre de tours (le client la respecte déjà côté UI).
      const played = history.filter((m) => m.role === "apprenant").length;
      if (played >= DEMO_MAX_TURNS) return FALLBACK("max_turns");

      const upstream = await demoReplyStream(caseId, history, message);
      await recordInteraction("demo_turn_played", { meta: { caseId, turn: played + 1 } });

      const encoder = new TextEncoder();
      const readable = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const chunk of upstream) controller.enqueue(encoder.encode(chunk));
            controller.close();
          } catch (e) {
            console.error("[demo] flux patient interrompu", e);
            controller.error(e);
          }
        },
      });
      return new Response(readable, {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }

    return NextResponse.json({ error: "action inconnue" }, { status: 400 });
  } catch (e) {
    // Toute erreur (clé LLM absente, JSON du débrief invalide…) ⇒ repli silencieux.
    console.error("[demo] échec", action, e);
    return FALLBACK("error");
  }
}
