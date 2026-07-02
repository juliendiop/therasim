import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildOverview } from "@/lib/progress";
import { userFrameworkAccess } from "@/lib/entitlements";
import { TYPE_LABEL, pct } from "@/lib/ui";

export const dynamic = "force-dynamic";

// Vue d'ensemble : une tuile par référentiel accordé au tenant (spec §5.6).
// JAMAIS de moyenne globale entre référentiels (règle d'or §2.4).
// Freemium B2C : les référentiels verrouillés restent VISIBLES (vitrine
// incitative — nom, compétences, cadenas) et mènent au paywall /f/[id].
export default async function CataloguePage() {
  const user = await requireUser();
  const access = await userFrameworkAccess(user);
  // Tuiles avec progression = accès effectif de l'utilisateur (peut dépasser le
  // catalogue de sa plateforme si l'opt-in « offres individuelles » est activé).
  const { frameworks } = await buildOverview(user.id, user.tenantId, access.unlocked);

  const unlocked = frameworks;

  // Aperçu des compétences pour les référentiels verrouillés (l'incitatif).
  const lockedFrameworks =
    access.locked.size > 0
      ? await prisma.framework.findMany({
          where: { id: { in: [...access.locked] }, statut: "publie" },
          orderBy: { nom: "asc" },
        })
      : [];
  const lockedGridIds = [...new Set(lockedFrameworks.map((f) => f.gridId))];
  const lockedComps =
    lockedGridIds.length > 0
      ? await prisma.competency.findMany({
          where: { gridId: { in: lockedGridIds } },
          orderBy: { ordre: "asc" },
        })
      : [];
  const compsByGrid = new Map<string, string[]>();
  for (const c of lockedComps) {
    const arr = compsByGrid.get(c.gridId) ?? [];
    arr.push(c.nom);
    compsByGrid.set(c.gridId, arr);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Domaines d&apos;entraînement</h1>
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

      <h2 className="mt-8 text-lg font-semibold">Vos domaines</h2>

      {unlocked.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-[var(--border)] bg-white p-8 text-center text-sm text-[var(--muted)]">
          Aucun domaine n&apos;est encore débloqué sur votre compte.
        </div>
      ) : (
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {unlocked.map((f) => (
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

      {/* Vitrine : domaines verrouillés (freemium) */}
      {lockedFrameworks.length > 0 && (
        <>
          <h2 className="mt-10 flex items-center gap-2 text-lg font-semibold">
            <Lock className="h-4 w-4 text-[var(--ochre)]" /> À débloquer
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            De nouvelles compétences à travailler — via un forfait ou à l&apos;unité.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {lockedFrameworks.map((f) => {
              const noms = compsByGrid.get(f.gridId) ?? [];
              return (
                <Link
                  key={f.id}
                  href={`/f/${f.id}`}
                  className="group rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-tint)] p-5 transition hover:border-[var(--ochre)] hover:shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-[var(--ochre-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--ochre)]">
                      {TYPE_LABEL[f.type] ?? f.type}
                    </span>
                    <Lock className="h-4 w-4 text-[var(--ochre)]" />
                  </div>
                  <h2 className="mt-3 text-lg font-semibold group-hover:text-[var(--ochre)]">
                    {f.nom}
                  </h2>
                  {f.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">
                      {f.description}
                    </p>
                  )}
                  <p className="mt-3 text-xs text-[var(--muted)]">
                    <b>{noms.length} compétences</b>
                    {noms.length > 0 && <> : {noms.slice(0, 3).join(" · ")}{noms.length > 3 ? "…" : ""}</>}
                  </p>
                  <div className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--ochre)]">
                    Découvrir <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        </>
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
