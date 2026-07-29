import Link from "next/link";
import { ArrowRight, History, MessagesSquare } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listSimHistory } from "@/lib/sim-history";
import { KIND_LABEL, fmtDateTime } from "@/lib/ui";
import { patientDisplayName } from "@/lib/patient";
import PatientAvatar from "@/app/_components/patient-avatar";

export const dynamic = "force-dynamic";

// Historique des mises en situation : chaque ligne rouvre la session
// (conversation complète + débrief) — les crédits dépensés laissent une trace.
export default async function HistoriquePage() {
  const user = await requireUser();
  const sims = await listSimHistory(user.id, 100);

  return (
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <History className="h-6 w-6 text-[var(--accent)]" /> Mon historique
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
        Toutes vos mises en situation — mini-scènes et séances simulées. Rouvrez-en une
        pour relire la conversation et son débrief, ou reprendre là où vous l&apos;aviez
        laissée.
      </p>

      {sims.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-[var(--border)] bg-white p-8 text-center text-sm text-[var(--muted)]">
          <MessagesSquare className="mx-auto mb-2 h-6 w-6" />
          Aucune mise en situation pour l&apos;instant. Lancez une mini-scène ou un
          séance simulée depuis un{" "}
          <Link href="/catalogue" className="font-medium text-[var(--accent)] hover:underline">
            domaine du catalogue
          </Link>
          .
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {sims.map((s) => (
            <Link
              key={s.id}
              href={`/sim/${s.id}`}
              className="group flex items-center gap-4 rounded-xl border border-[var(--border)] bg-white p-4 transition hover:border-[var(--accent)] hover:shadow-sm"
            >
              <PatientAvatar
                name={patientDisplayName(s.scenarioTitre)}
                seed={s.scenarioTitre}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 font-medium text-[var(--accent)]">
                    {KIND_LABEL[s.kind] ?? s.kind}
                  </span>
                  {s.statut === "en_cours" && (
                    <span className="rounded-full bg-[var(--ochre-soft)] px-2.5 py-0.5 font-medium text-[var(--ochre)]">
                      en cours — reprendre
                    </span>
                  )}
                  <span className="text-[var(--muted)]">{fmtDateTime(s.createdAt)}</span>
                </div>
                <div className="mt-1 truncate font-semibold group-hover:text-[var(--accent)]">
                  {s.scenarioTitre}
                </div>
                <div className="mt-0.5 text-xs text-[var(--muted)]">
                  {s.frameworkNom} · {s.tours} tour{s.tours > 1 ? "s" : ""}
                </div>
              </div>
              {s.moyenne !== null && (
                <div className="shrink-0 text-right">
                  <div className="tabular text-lg font-semibold">
                    {s.moyenne.toFixed(1).replace(".", ",")}
                    <span className="text-sm font-normal text-[var(--muted)]">/5</span>
                  </div>
                  <div className="text-[11px] text-[var(--muted)]">note moyenne</div>
                </div>
              )}
              <ArrowRight className="h-4 w-4 shrink-0 text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
