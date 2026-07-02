import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, User2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canSupervise } from "@/lib/roles";
import { getLearnerInTenant, listNotes } from "@/lib/supervision";
import type { Debrief } from "@/lib/simulator";
import { KIND_LABEL, fmtDateTime } from "@/lib/ui";
import { addNoteAction } from "../../../actions";

export const dynamic = "force-dynamic";

// Relecture (lecture seule) d'une mise en situation d'un apprenant : transcript
// complet + débrief. Pas d'interaction possible — la session appartient à l'apprenant.
export default async function SupervisionSimPage({
  params,
}: {
  params: Promise<{ id: string; simId: string }>;
}) {
  const { id, simId } = await params;
  const user = await requireUser();
  if (!canSupervise(user.role)) redirect("/accueil");

  const learner = await getLearnerInTenant(id, user.tenantId);
  if (!learner) notFound();

  const session = await prisma.simSession.findUnique({ where: { id: simId } });
  if (!session || session.userId !== learner.id) notFound();

  const [scenario, framework, messages, notes] = await Promise.all([
    prisma.scenario.findUnique({ where: { id: session.scenarioId } }),
    prisma.framework.findUnique({ where: { id: session.frameworkId } }),
    prisma.simMessage.findMany({ where: { sessionId: simId }, orderBy: { turn: "asc" } }),
    listNotes(user.tenantId, learner.id),
  ]);
  const debrief = session.debrief as unknown as Debrief | null;
  const notesForSession = notes.filter((n) => n.sessionId === simId);

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/supervision/${learner.id}`}
        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-4 w-4" /> {learner.email}
      </Link>

      <div className="mt-3">
        <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--accent)]">
          {KIND_LABEL[session.kind] ?? session.kind}
        </span>
        <h1 className="mt-1.5 text-lg font-semibold">{scenario?.titre ?? "Entretien"}</h1>
        <p className="text-xs text-[var(--muted)]">
          {framework?.nom} · {fmtDateTime(session.createdAt)}
          {session.statut === "en_cours" && " · en cours"}
        </p>
      </div>

      {/* Transcript (lecture seule) */}
      <div className="mt-4 space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "apprenant" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                m.role === "apprenant"
                  ? "bg-[var(--accent)] text-white"
                  : "border border-[var(--border)] bg-white"
              }`}
            >
              {m.role === "patient" && (
                <div className="mb-0.5 flex items-center gap-1 text-[11px] font-medium text-[var(--muted)]">
                  <User2 className="h-3 w-3" /> Patient
                </div>
              )}
              {m.content}
            </div>
          </div>
        ))}
        {messages.length === 0 && (
          <p className="text-center text-sm text-[var(--muted)]">
            Aucun échange enregistré.
          </p>
        )}
      </div>

      {/* Débrief */}
      {debrief && (
        <div className="mt-8 border-t border-[var(--border)] pt-6">
          <h2 className="text-lg font-semibold">Débrief</h2>
          {debrief.narrative && (
            <p className="mt-2 rounded-xl border border-[var(--border)] bg-white p-4 text-sm">
              {debrief.narrative}
            </p>
          )}
          {debrief.scores.filter((s) => !s.non_evalue).length > 0 && (
            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-semibold">Évaluation par compétence</h3>
              {debrief.scores
                .filter((s) => !s.non_evalue)
                .map((s) => (
                  <div
                    key={s.competency_id}
                    className="rounded-lg border border-[var(--border)] bg-white p-3 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{s.competency_id}</span>
                      <span className="font-semibold">{s.note}/5</span>
                    </div>
                    {s.justification && (
                      <p className="mt-1 text-xs text-[var(--muted)]">{s.justification}</p>
                    )}
                  </div>
                ))}
            </div>
          )}
          {debrief.moments.length > 0 && (
            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-semibold">Moments clés</h3>
              {debrief.moments.map((m, i) => (
                <div key={i} className="rounded-lg bg-gray-50 p-3 text-sm">
                  <p className="italic">« {m.quote} »</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{m.comment}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Note sur cette mise en situation précise */}
      <div className="mt-8 border-t border-[var(--border)] pt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Note sur cette mise en situation
        </h2>
        <form action={addNoteAction} className="mt-3 flex items-start gap-2">
          <input type="hidden" name="learnerId" value={learner.id} />
          <input type="hidden" name="sessionId" value={simId} />
          <textarea
            name="body"
            required
            rows={2}
            placeholder="Votre retour sur cet entretien précis…"
            className="flex-1 rounded-lg border border-[var(--border)] p-2.5 text-sm outline-none focus:border-[var(--accent)]"
          />
          <button className="shrink-0 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)]">
            Ajouter
          </button>
        </form>
        {notesForSession.length > 0 && (
          <div className="mt-3 space-y-2">
            {notesForSession.map((n) => (
              <div
                key={n.id}
                className="rounded-lg border border-[var(--border)] bg-white p-3 text-sm"
              >
                <p>{n.body}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {n.authorEmail} · {fmtDateTime(n.createdAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
