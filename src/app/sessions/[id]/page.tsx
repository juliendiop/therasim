import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Play, Radio, Square, Timer } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getLiveResults, getSessionPairs, roleCanManageLive } from "@/lib/live";
import {
  closeSessionAction,
  openSessionAction,
  startCountdownAction,
} from "../actions";
import LiveDashboard from "./dashboard";

export const dynamic = "force-dynamic";

export default async function SessionManage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!roleCanManageLive(user.role)) redirect("/catalogue");

  const session = await prisma.liveSession.findUnique({ where: { id } });
  if (!session || session.tenantId !== user.tenantId) notFound();

  const pairs = getSessionPairs(session);
  const frameworks = await prisma.framework.findMany({
    where: { id: { in: Array.from(new Set(pairs.map((p) => p.frameworkId))) } },
  });
  const fwNames = frameworks.map((f) => f.nom).join(", ");
  const results = await getLiveResults(id);

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.includes("localhost") ? "http" : "https";
  const base = process.env.APP_BASE_URL || `${proto}://${host}`;
  const joinUrl = `${base}/live/${id}`;

  const STATUT_LABEL: Record<string, string> = {
    brouillon: "brouillon",
    ouverte: "ouverte — en attente du démarrage",
    en_cours: "en cours",
    fermee: "terminée",
  };

  return (
    <div>
      <Link
        href="/sessions"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-4 w-4" /> Sessions live
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{session.titre}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {fwNames || "—"} · {pairs.length} compétence(s) ·{" "}
            {session.mode === "apprentissage" ? "mode apprentissage" : "mode évaluation"} ·{" "}
            <span className="font-medium">{STATUT_LABEL[session.statut] ?? session.statut}</span>
          </p>
        </div>

        {/* Contrôles selon l'étape */}
        {session.statut === "brouillon" && (
          <form action={openSessionAction}>
            <input type="hidden" name="id" value={id} />
            <button className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]">
              <Radio className="h-4 w-4" /> Ouvrir la session
            </button>
          </form>
        )}
        {session.statut === "ouverte" && (
          <form action={startCountdownAction} className="flex items-end gap-2">
            <input type="hidden" name="id" value={id} />
            <div>
              <label className="text-[11px] font-medium text-[var(--muted)]">Durée (min)</label>
              <input
                type="number"
                name="durationMin"
                defaultValue={session.durationMin}
                min={1}
                max={180}
                className="mt-0.5 block w-20 rounded-lg border border-[var(--border)] p-2 text-sm"
              />
            </div>
            <button className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]">
              <Timer className="h-4 w-4" /> Démarrer le compte à rebours
            </button>
          </form>
        )}
        {session.statut === "en_cours" && (
          <form action={closeSessionAction}>
            <input type="hidden" name="id" value={id} />
            <button className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50">
              <Square className="h-4 w-4" /> Fermer maintenant
            </button>
          </form>
        )}
        {session.statut === "fermee" && (
          <span className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-[var(--muted)]">
            Session terminée
          </span>
        )}
      </div>

      {session.statut === "brouillon" ? (
        <div className="mt-6 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-5 text-sm">
          <b>Étape 1.</b> Cliquez sur <b>Ouvrir la session</b> : le lien devient actif, les
          participants peuvent le rejoindre et patienter. <b>Le compte à rebours ne démarre
          pas encore.</b> Quand tout le monde est prêt, vous lancerez le chrono.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {session.statut === "ouverte" && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <Play className="h-4 w-4 shrink-0" />
              Partagez le lien ci-dessous. Les participants apparaissent en bas. Cliquez sur
              <b className="mx-1">Démarrer le compte à rebours</b> quand vous êtes prêt.
            </div>
          )}
          <LiveDashboard
            sessionId={id}
            joinUrl={joinUrl}
            initial={{
              statut: session.statut,
              mode: session.mode,
              closesAt: session.closesAt ? session.closesAt.toISOString() : null,
              results,
            }}
          />
        </div>
      )}
    </div>
  );
}
