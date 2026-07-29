import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Sparkles, Trophy } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canSupervise } from "@/lib/roles";
import { getLearnerInTenant, listNotes } from "@/lib/supervision";
import type { Debrief } from "@/lib/simulator";
import { matchMoments } from "@/lib/moment-match";
import { patientDisplayName } from "@/lib/patient";
import PatientAvatar from "@/app/_components/patient-avatar";
import { KIND_LABEL, fmtDateTime } from "@/lib/ui";
import { addNoteAction } from "../../../actions";

export const dynamic = "force-dynamic";

// Relecture (lecture seule) d'une mise en situation d'un apprenant : transcript
// complet + débrief, moments clés surlignés en contexte (replay annoté). Pas
// d'interaction possible — la session appartient à l'apprenant.
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
  const competencies = framework
    ? await prisma.competency.findMany({ where: { gridId: framework.gridId } })
    : [];
  const nomByCode = new Map(competencies.map((c) => [c.code, c.nom]));
  const debrief = session.debrief as unknown as Debrief | null;
  const notesForSession = notes.filter((n) => n.sessionId === simId);
  const patientName = patientDisplayName(scenario?.titre ?? "Séance");
  const avatarSeed = scenario?.titre ?? simId;
  const moments = debrief ? matchMoments(messages, debrief.moments) : null;
  const unmatchedMoments = moments?.unmatched ?? debrief?.moments ?? [];

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/supervision/${learner.id}`}
        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-4 w-4" /> {learner.email}
      </Link>

      <div className="mt-3 flex items-center gap-3">
        <PatientAvatar name={patientName} seed={avatarSeed} size="lg" />
        <div>
          <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--accent)]">
            {KIND_LABEL[session.kind] ?? session.kind}
          </span>
          <h1 className="mt-1.5 text-lg font-semibold">{scenario?.titre ?? "Séance"}</h1>
          <p className="text-xs text-[var(--muted)]">
            {framework?.nom} · {fmtDateTime(session.createdAt)}
            {session.statut === "en_cours" && " · en cours"}
          </p>
        </div>
      </div>

      {/* Transcript (lecture seule) — moments clés surlignés en contexte */}
      <div className="mt-4 space-y-3">
        {messages.map((m, i) => (
          <div key={m.id}>
            <div
              className={`flex items-end gap-2 ${m.role === "apprenant" ? "justify-end" : "justify-start"}`}
            >
              {m.role === "patient" && (
                <PatientAvatar name={patientName} seed={avatarSeed} size="sm" />
              )}
              <div
                className={`max-w-[80%] break-words rounded-2xl px-4 py-2 text-sm ${
                  m.role === "apprenant"
                    ? "bg-[var(--accent)] text-white"
                    : "border border-[var(--border)] bg-white"
                } ${moments?.byIndex.has(i) ? "ring-2 ring-[var(--ochre)] ring-offset-1" : ""}`}
              >
                {m.role === "patient" && (
                  <div className="mb-0.5 text-[11px] font-medium text-[var(--muted)]">
                    {patientName}
                  </div>
                )}
                {m.content}
              </div>
            </div>
            {moments?.byIndex.get(i)?.map((moment, j) => (
              <div
                key={j}
                className={`mt-1 flex ${m.role === "apprenant" ? "justify-end" : "justify-start ml-10"}`}
              >
                <div className="flex max-w-[80%] items-start gap-1.5 rounded-lg border border-[var(--ochre-soft)] bg-[var(--ochre-soft)] px-3 py-1.5 text-xs text-[var(--ink-soft)]">
                  <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-[var(--ochre)]" />
                  {moment.comment}
                </div>
              </div>
            ))}
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

          {debrief.level_ups && debrief.level_ups.length > 0 && (
            <div className="mt-3 space-y-2">
              {debrief.level_ups.map((lu) => (
                <div
                  key={lu.competency_id}
                  className="flex items-center gap-2.5 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-3 text-sm"
                >
                  <Trophy className="h-5 w-5 shrink-0 text-[var(--accent)]" />
                  <span>
                    <b>{lu.nom}</b> — palier <b>{lu.palier}</b> atteint sur cette séance.
                  </span>
                </div>
              ))}
            </div>
          )}

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
                      <span className="font-medium">
                        {nomByCode.get(s.competency_id) ?? s.competency_id}
                      </span>
                      <span className="font-semibold">{s.note}/5</span>
                    </div>
                    {s.justification && (
                      <p className="mt-1 text-xs text-[var(--muted)]">{s.justification}</p>
                    )}
                  </div>
                ))}
            </div>
          )}
          {unmatchedMoments.length > 0 && (
            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-semibold">Autres moments clés</h3>
              {unmatchedMoments.map((m, i) => (
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
            placeholder="Votre retour sur cette séance précise…"
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
