import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, MessageSquarePlus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { canSupervise } from "@/lib/roles";
import { getLearnerInTenant, listNotes } from "@/lib/supervision";
import { buildOverview } from "@/lib/progress";
import { listSimHistory } from "@/lib/sim-history";
import { KIND_LABEL, TYPE_LABEL, fmtDate, fmtDateTime, pct } from "@/lib/ui";
import { patientDisplayName } from "@/lib/patient";
import PatientAvatar from "@/app/_components/patient-avatar";
import { addNoteAction } from "../actions";

export const dynamic = "force-dynamic";

// Détail supervision d'un apprenant : progression par référentiel (jamais de
// moyenne entre référentiels — règle d'or), historique des mises en situation,
// et fil de notes du formateur.
export default async function SupervisionLearnerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!canSupervise(user.role)) redirect("/accueil");

  const learner = await getLearnerInTenant(id, user.tenantId);
  if (!learner) notFound();

  const [{ frameworks }, sims, notes] = await Promise.all([
    buildOverview(learner.id, user.tenantId),
    listSimHistory(learner.id, 20),
    listNotes(user.tenantId, learner.id),
  ]);

  return (
    <div>
      <Link
        href="/supervision"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-4 w-4" /> Supervision
      </Link>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{learner.email}</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Apprenant depuis le {fmtDate(learner.createdAt)}.
      </p>

      {/* Progression par référentiel */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Progression
        </h2>
        {frameworks.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            Aucun domaine accessible sur cette plateforme.
          </p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {frameworks.map((f) => (
              <div
                key={f.id}
                className="rounded-xl border border-[var(--border)] bg-white p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--accent)]">
                    {TYPE_LABEL[f.type] ?? f.type}
                  </span>
                  <span className="text-lg font-semibold">{pct(f.mastery_moyenne)}</span>
                </div>
                <div className="mt-1.5 font-semibold">{f.nom}</div>
                <div className="mt-0.5 text-xs text-[var(--muted)]">
                  {f.competences_couvertes}/{f.competences_total} compétences couvertes
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Mises en situation */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Mises en situation ({sims.length})
        </h2>
        {sims.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">Aucune pour l&apos;instant.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {sims.map((s) => (
              <Link
                key={s.id}
                href={`/supervision/${learner.id}/sim/${s.id}`}
                className="group flex items-center gap-4 rounded-xl border border-[var(--border)] bg-white p-3.5 transition hover:border-[var(--accent)] hover:shadow-sm"
              >
                <PatientAvatar name={patientDisplayName(s.scenarioTitre)} seed={s.scenarioTitre} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-medium text-[var(--accent)]">
                      {KIND_LABEL[s.kind] ?? s.kind}
                    </span>
                    <span className="text-[var(--muted)]">{fmtDateTime(s.createdAt)}</span>
                  </div>
                  <div className="truncate text-sm font-medium group-hover:text-[var(--accent)]">
                    {s.scenarioTitre}{" "}
                    <span className="font-normal text-[var(--muted)]">· {s.frameworkNom}</span>
                  </div>
                </div>
                {s.moyenne !== null && (
                  <div className="shrink-0 text-right text-sm font-semibold">
                    {s.moyenne.toFixed(1).replace(".", ",")}/5
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Notes du formateur */}
      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          <MessageSquarePlus className="h-4 w-4" /> Notes
        </h2>
        <form action={addNoteAction} className="mt-3 flex items-start gap-2">
          <input type="hidden" name="learnerId" value={learner.id} />
          <textarea
            name="body"
            required
            rows={2}
            placeholder="Un retour pour cet apprenant (visible par l'équipe de la plateforme)…"
            className="flex-1 rounded-lg border border-[var(--border)] p-2.5 text-sm outline-none focus:border-[var(--accent)]"
          />
          <button className="shrink-0 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)]">
            Ajouter
          </button>
        </form>
        {notes.length > 0 && (
          <div className="mt-3 space-y-2">
            {notes.map((n) => (
              <div
                key={n.id}
                className="rounded-lg border border-[var(--border)] bg-white p-3 text-sm"
              >
                <p>{n.body}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {n.authorEmail} · {fmtDateTime(n.createdAt)}
                  {n.sessionId && (
                    <>
                      {" · "}
                      <Link
                        href={`/supervision/${learner.id}/sim/${n.sessionId}`}
                        className="text-[var(--accent)] hover:underline"
                      >
                        voir la mise en situation
                      </Link>
                    </>
                  )}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
