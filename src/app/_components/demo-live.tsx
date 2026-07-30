"use client";

// Démo publique JOUABLE (mini-scène N2), sans compte. Le navigateur porte le fil
// de conversation et le renvoie à chaque tour (aucun état serveur). Si l'endpoint
// refuse (budget/quota atteint, IA indisponible…), on bascule SILENCIEUSEMENT sur
// la démo statique passée en `fallback` — qui reste le filet permanent.

import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Layers,
  Lightbulb,
  MessageCircle,
  RotateCcw,
  Send,
  Sparkles,
  Target,
} from "lucide-react";
import { trackEvent } from "./track";
import type { DemoCaseView } from "@/lib/demo-sim";

const MAX_TURNS = 4;

type Msg = { role: "patient" | "apprenant"; content: string };
type Debrief = { verdict: string; forces: string[]; pistes: string[] };
type Phase = "pick" | "chat" | "debrief";

export default function DemoLive({
  cases,
  fallback,
}: {
  cases: DemoCaseView[];
  fallback: React.ReactNode;
}) {
  const [useFallback, setUseFallback] = useState(false);
  const [phase, setPhase] = useState<Phase>("pick");
  const [active, setActive] = useState<DemoCaseView | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [debrief, setDebrief] = useState<Debrief | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Aucun cas exploitable (base vide en dev) : on montre directement le filet.
  if (useFallback || cases.length === 0) return <>{fallback}</>;

  const turnsPlayed = messages.filter((m) => m.role === "apprenant").length;
  const canSend = !busy && draft.trim().length > 0 && turnsPlayed < MAX_TURNS;

  function scrollDown() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  async function startCase(c: DemoCaseView) {
    trackEvent("demo_start", "/"); // mesure d'entonnoir (1er engagement)
    setActive(c);
    setPhase("chat");
    setMessages([]);
    setDebrief(null);
    setBusy(true);
    try {
      const res = await fetch("/api/demo/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: c.id, action: "start" }),
      });
      const data = await res.json().catch(() => null);
      if (!data || data.fallback || !data.opener) {
        setUseFallback(true);
        return;
      }
      setMessages([{ role: "patient", content: data.opener }]);
      scrollDown();
    } catch {
      setUseFallback(true);
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!active || !canSend) return;
    const text = draft.trim();
    const history = [...messages];
    setMessages((m) => [...m, { role: "apprenant", content: text }]);
    setDraft("");
    setBusy(true);
    setStreaming("");
    scrollDown();
    try {
      const res = await fetch("/api/demo/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: active.id, action: "reply", history, message: text }),
      });
      // Réponse JSON = repli demandé par le serveur ; sinon flux texte.
      if (res.headers.get("content-type")?.includes("application/json")) {
        const data = await res.json().catch(() => null);
        if (data?.fallback) setUseFallback(true);
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) {
        setUseFallback(true);
        return;
      }
      const decoder = new TextDecoder();
      let full = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setStreaming(full);
        scrollDown();
      }
      setMessages((m) => [...m, { role: "patient", content: full.trim() }]);
      setStreaming("");
      scrollDown();
    } catch {
      setUseFallback(true);
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!active) return;
    setBusy(true);
    setPhase("debrief");
    try {
      const res = await fetch("/api/demo/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: active.id, action: "debrief", history: messages }),
      });
      const data = await res.json().catch(() => null);
      if (!data || data.fallback || !data.debrief) {
        setUseFallback(true);
        return;
      }
      setDebrief(data.debrief as Debrief);
    } catch {
      setUseFallback(true);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setPhase("pick");
    setActive(null);
    setMessages([]);
    setDraft("");
    setDebrief(null);
    setStreaming("");
  }

  // ---- Écran 1 : choix du cas -------------------------------------------
  if (phase === "pick") {
    return (
      <div className="mx-auto max-w-2xl text-left">
        <div className="grid gap-3 sm:grid-cols-3">
          {cases.map((c) => (
            <button
              key={c.id}
              onClick={() => startCase(c)}
              disabled={busy}
              className="card-soft flex flex-col p-4 text-left transition hover:border-[var(--accent)] hover:shadow-sm disabled:opacity-60"
            >
              <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                <Layers className="h-3 w-3" /> {c.domaine}
              </span>
              <span className="mt-2 text-sm font-semibold">{c.titre}</span>
              <span className="mt-1 line-clamp-3 text-xs text-[var(--muted)]">{c.contexte}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-[var(--muted)]">
          Choisissez un cas et parlez au patient — 4 échanges, en toutes lettres. Puis un
          débrief immédiat.
        </p>
      </div>
    );
  }

  // ---- Écran 3 : micro-débrief ------------------------------------------
  if (phase === "debrief") {
    return (
      <div className="card-soft mx-auto max-w-2xl p-6 text-left">
        <div className="flex items-center gap-2 text-[var(--accent)]">
          <BookOpen className="h-5 w-5" />
          <h3 className="text-sm font-semibold uppercase tracking-wide">Votre micro-débrief</h3>
        </div>
        {busy && !debrief ? (
          <p className="mt-4 animate-pulse text-sm text-[var(--muted)]">
            Analyse de vos réponses…
          </p>
        ) : debrief ? (
          <div className="mt-4 space-y-4">
            {debrief.verdict && <p className="text-[15px]">{debrief.verdict}</p>}
            {debrief.forces.length > 0 && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-green-800">
                  <Sparkles className="h-4 w-4" /> Ce qui a marché
                </div>
                <ul className="mt-1.5 space-y-1 text-sm text-green-900">
                  {debrief.forces.map((f, i) => (
                    <li key={i}>• {f}</li>
                  ))}
                </ul>
              </div>
            )}
            {debrief.pistes.length > 0 && (
              <div className="rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-4">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-[var(--accent)]">
                  <Lightbulb className="h-4 w-4" /> Pistes pour aller plus loin
                </div>
                <ul className="mt-1.5 space-y-1 text-sm">
                  {debrief.pistes.map((p, i) => (
                    <li key={i}>• {p}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}

        {/* Bascule vers le produit complet */}
        <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface-tint)] p-4">
          <p className="text-sm font-medium">
            Envie du débrief <b>détaillé</b>, compétence par compétence ?
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            En créant votre compte gratuit, vous menez une <b>séance complète offerte</b> avec un
            patient qui réagit à votre posture — et vous obtenez le débrief noté sur chaque
            compétence, avec citations de vos propres mots.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Link
              href="/inscription"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
            >
              <Sparkles className="h-4 w-4" /> Créer mon compte gratuit <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              onClick={reset}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--accent)] transition hover:bg-[var(--accent-soft)]"
            >
              <RotateCcw className="h-4 w-4" /> Essayer un autre cas
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Écran 2 : dialogue ------------------------------------------------
  return (
    <div className="card-soft mx-auto max-w-2xl p-4 text-left sm:p-6">
      {active && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-[var(--border)] pb-3 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          <span className="inline-flex items-center gap-1 text-[var(--accent)]">
            <Target className="h-3.5 w-3.5" />
            {active.competences.join(" · ")}
          </span>
          <span className="tabular">
            échange {Math.min(turnsPlayed + (busy ? 1 : 0), MAX_TURNS)}/{MAX_TURNS}
          </span>
        </div>
      )}

      <div ref={scrollRef} className="mt-3 max-h-[22rem] space-y-3 overflow-y-auto pr-1">
        {messages.map((m, i) =>
          m.role === "patient" ? (
            <PatientBubble key={i} text={m.content} />
          ) : (
            <LearnerBubble key={i} text={m.content} />
          ),
        )}
        {streaming && <PatientBubble text={streaming} />}
        {busy && !streaming && (
          <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <MessageCircle className="h-4 w-4 animate-pulse" /> le patient réfléchit…
          </div>
        )}
      </div>

      {turnsPlayed < MAX_TURNS ? (
        <div className="mt-4">
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={2}
              maxLength={800}
              disabled={busy}
              placeholder="Que répondez-vous au patient ?"
              className="flex-1 resize-none rounded-lg border border-[var(--border)] p-2.5 text-sm focus:border-[var(--accent)] focus:outline-none disabled:opacity-60"
            />
            <button
              onClick={() => void send()}
              disabled={!canSend}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          {turnsPlayed >= 2 && (
            <button
              onClick={() => void finish()}
              disabled={busy}
              className="mt-2 text-xs font-medium text-[var(--accent)] hover:underline disabled:opacity-50"
            >
              Terminer et voir mon débrief →
            </button>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <button
            onClick={() => void finish()}
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
          >
            <BookOpen className="h-4 w-4" /> Voir mon micro-débrief
          </button>
        </div>
      )}

      <p className="mt-3 text-center text-[11px] text-[var(--muted)]">
        Patient simulé, cas fictif. Rien de ce que vous écrivez n&apos;est conservé.
      </p>
    </div>
  );
}

function PatientBubble({ text }: { text: string }) {
  return (
    <div className="flex gap-2">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
        <MessageCircle className="h-4 w-4" />
      </span>
      <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-3.5 py-2 text-sm shadow-sm ring-1 ring-[var(--border)]">
        {text}
      </div>
    </div>
  );
}

function LearnerBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-[var(--accent)] px-3.5 py-2 text-sm text-white">
        {text}
      </div>
    </div>
  );
}
