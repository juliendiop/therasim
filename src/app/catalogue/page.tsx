import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { buildOverview } from "@/lib/progress";
import { TYPE_LABEL, pct } from "@/lib/ui";

export const dynamic = "force-dynamic";

// Vue d'ensemble : une tuile par référentiel accordé au tenant (spec §5.6).
// JAMAIS de moyenne globale entre référentiels (règle d'or §2.4).
export default async function CataloguePage() {
  const user = await requireUser();
  const { frameworks } = await buildOverview(user.id, user.tenantId);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Référentiels</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Choisissez un référentiel pour voir votre carte de progression et vous entraîner.
        Chaque référentiel a son propre profil — ils ne se mélangent jamais.
      </p>

      {frameworks.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-[var(--border)] bg-white p-8 text-center text-sm text-[var(--muted)]">
          Aucun référentiel publié. Lancez le seed (<code>npm run db:seed</code>) pour
          charger l&apos;entretien motivationnel (EM).
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {frameworks.map((f) => (
            <Link
              key={f.id}
              href={`/f/${f.id}`}
              className="group rounded-xl border border-[var(--border)] bg-white p-5 transition hover:border-[var(--accent)] hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--accent)]">
                  {TYPE_LABEL[f.type] ?? f.type}
                </span>
                <span className="text-xs font-medium text-[var(--muted)]">
                  niveau {f.niveau}
                </span>
              </div>
              <h2 className="mt-3 text-lg font-semibold group-hover:text-[var(--accent)]">
                {f.nom}
              </h2>
              {f.description && (
                <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">
                  {f.description}
                </p>
              )}
              <div className="mt-4 flex items-center gap-4 text-sm">
                <div>
                  <div className="font-semibold">{pct(f.mastery_moyenne)}</div>
                  <div className="text-xs text-[var(--muted)]">maîtrise moy.</div>
                </div>
                <div>
                  <div className="font-semibold">
                    {f.competences_couvertes}/{f.competences_total}
                  </div>
                  <div className="text-xs text-[var(--muted)]">couvertes</div>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
