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
      <h1 className="text-2xl font-semibold tracking-tight">Bienvenue 👋</h1>
      <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
        Entraînez-vous à la pratique clinique sur des cas réalistes — du feedback immédiat
        jusqu&apos;à l&apos;entretien complet — et suivez vos progrès, compétence par compétence.
      </p>

      {/* Comment ça marche */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Step n="1" titre="Choisissez un domaine" desc="Une approche ou une compétence clinique à travailler." />
        <Step n="2" titre="Entraînez-vous" desc="Du guidé à l'autonome, à votre rythme." />
        <Step n="3" titre="Visualisez vos progrès" desc="Vos forces et vos lacunes, mises à jour en temps réel." />
      </div>

      <h2 className="mt-8 text-lg font-semibold">Choisissez un domaine à travailler</h2>

      {frameworks.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-[var(--border)] bg-white p-8 text-center text-sm text-[var(--muted)]">
          Aucun domaine n&apos;est encore disponible sur votre espace. Revenez bientôt !
        </div>
      ) : (
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
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

function Step({ n, titre, desc }: { n: string; titre: string; desc: string }) {
  return (
    <div className="flex gap-3 rounded-xl border border-[var(--border)] bg-white p-4">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent)]">
        {n}
      </span>
      <div>
        <div className="text-sm font-semibold">{titre}</div>
        <div className="mt-0.5 text-xs text-[var(--muted)]">{desc}</div>
      </div>
    </div>
  );
}
