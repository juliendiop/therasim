import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Dumbbell, Layers, MessagesSquare, RotateCcw } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { tenantCanAccess } from "@/lib/entitlements";
import { startMiniSceneAction } from "@/app/sim/actions";
import { buildFrameworkDetail } from "@/lib/progress";
import { palier } from "@/lib/mastery";
import { PALIER_COLOR, TYPE_LABEL, pct } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function FrameworkPage({
  params,
}: {
  params: Promise<{ framework_id: string }>;
}) {
  const { framework_id } = await params;
  const user = await requireUser();
  // Garde d'accès : le tenant doit avoir ce référentiel dans ses droits.
  if (!(await tenantCanAccess(user.tenantId, framework_id))) notFound();
  const detail = await buildFrameworkDetail(user.id, framework_id);
  if (!detail) notFound();

  const { framework, overall, categories, priorites } = detail;

  return (
    <div>
      <Link
        href="/catalogue"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-4 w-4" /> Tous les référentiels
      </Link>

      {/* En-tête */}
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--accent)]">
            {TYPE_LABEL[framework.type] ?? framework.type}
          </span>
          <h1 className="mt-2 text-2xl font-semibold">{framework.nom}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action={startMiniSceneAction}>
            <input type="hidden" name="frameworkId" value={framework.id} />
            <button className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:border-[var(--accent)] hover:text-[var(--accent)]">
              <Layers className="h-4 w-4" /> Mini-scène guidée
            </button>
          </form>
          <Link
            href={`/f/${framework.id}/simulation`}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)]"
          >
            <MessagesSquare className="h-4 w-4" /> Entretien simulé
          </Link>
          <Link
            href={`/f/${framework.id}/entrainement`}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
          >
            <Dumbbell className="h-4 w-4" /> S&apos;entraîner
          </Link>
        </div>
      </div>

      {/* Bandeau de stats */}
      <div className="mt-5 grid grid-cols-3 gap-4 rounded-xl border border-[var(--border)] bg-white p-5">
        <Stat label="Maîtrise moyenne" value={pct(overall.masteryMoyenne)} />
        <Stat
          label="Compétences couvertes"
          value={`${overall.competencesCouvertes}/${overall.competencesTotal}`}
        />
        <Stat label="Niveau" value={overall.niveau} />
      </div>

      {/* À travailler en priorité */}
      {priorites.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            À travailler en priorité
          </h2>
          <div className="mt-3 space-y-2">
            {priorites.map((p) => (
              <div
                key={p.competency_id}
                className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-white px-4 py-3"
              >
                <div>
                  <div className="font-medium">{p.nom}</div>
                  <div className="text-xs text-[var(--muted)]">{p.raison}</div>
                </div>
                <Link
                  href={`/f/${framework.id}/entrainement?competency=${p.competency_id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                >
                  <Dumbbell className="h-3.5 w-3.5" /> S&apos;entraîner
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Carte par catégorie */}
      <section className="mt-8 space-y-6">
        {categories.map((cat) => (
          <div key={cat.code}>
            <h3 className="text-sm font-semibold">{cat.nom}</h3>
            <div className="mt-2 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-white">
              {cat.competencies.map((c) => {
                const color = PALIER_COLOR[palier(c.mastery)];
                const filled = Math.min(c.attempts, 6);
                return (
                  <div key={c.id} className="flex items-center gap-4 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{c.nom}</span>
                        {c.aReviser && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                            <RotateCcw className="h-3 w-3" /> à réviser
                          </span>
                        )}
                      </div>
                      {/* Barre de maîtrise */}
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: c.mastery === null ? "0%" : `${c.mastery * 100}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-[var(--muted)]">
                        <span style={{ color }}>{c.palier}</span>
                        <span>·</span>
                        <span>{c.couverture}</span>
                      </div>
                    </div>
                    {/* Couverture (points) */}
                    <div className="flex shrink-0 items-center gap-1">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <span
                          key={i}
                          className="h-1.5 w-1.5 rounded-full"
                          style={{
                            backgroundColor: i < filled ? color : "#e5e7eb",
                          }}
                        />
                      ))}
                    </div>
                    <div className="w-12 shrink-0 text-right text-sm font-semibold">
                      {pct(c.mastery)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xl font-semibold">{value}</div>
      <div className="text-xs text-[var(--muted)]">{label}</div>
    </div>
  );
}
