import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Coins, Dumbbell, Layers, MessagesSquare, RotateCcw } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { userFrameworkAccess, resolveB2CEntitlement } from "@/lib/entitlements";
import { creditSettings, getWalletView, isUnlimited } from "@/lib/credits";
import { buildFrameworkDetail } from "@/lib/progress";
import { palier } from "@/lib/mastery";
import { PALIER_COLOR, TYPE_LABEL, pct } from "@/lib/ui";
import FrameworkPaywall from "./paywall";
import { MiniSceneLauncher, SeanceLauncher } from "./session-launchers";

export const dynamic = "force-dynamic";

export default async function FrameworkPage({
  params,
  searchParams,
}: {
  params: Promise<{ framework_id: string }>;
  searchParams: Promise<{
    success?: string;
    canceled?: string;
    error?: string;
    fairuse?: string;
  }>;
}) {
  const { framework_id } = await params;
  const { success, canceled, error, fairuse } = await searchParams;
  const user = await requireUser();
  // Garde d'accès : accès effectif de CET utilisateur (catalogue plateforme,
  // freemium B2C, ou vitrine étendue si sa plateforme B2B a l'opt-in).
  const [fw, access] = await Promise.all([
    prisma.framework.findUnique({ where: { id: framework_id } }),
    userFrameworkAccess(user),
  ]);
  if (!fw || fw.statut !== "publie") notFound();
  if (!access.unlocked.has(framework_id)) {
    // Verrouillé mais en vente -> vitrine incitative ; sinon hors périmètre.
    if (!access.locked.has(framework_id)) notFound();
    return (
      <FrameworkPaywall
        frameworkId={framework_id}
        userId={user.id}
        success={success}
        canceled={canceled}
        error={error}
      />
    );
  }
  const detail = await buildFrameworkDetail(user.id, framework_id);
  if (!detail) notFound();
  // Contexte pour le pré-check client des lancements (mini-scène / séance).
  const [credits, wallet, ent, unlimited, u] = await Promise.all([
    creditSettings(),
    getWalletView(user.id),
    resolveB2CEntitlement(user.id),
    isUnlimited(user.id),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { discoveryInterviewUsedAt: true },
    }),
  ]);
  const discoveryAvailable = !ent.entitledSub && !u?.discoveryInterviewUsedAt;
  const launch = {
    frameworkId: framework_id,
    total: wallet.total,
    isUnlimited: unlimited,
    entitledSub: ent.entitledSub,
    // Séance découverte encore disponible (gratuite, à vie) : compte gratuit non encore utilisé.
    discoveryAvailable,
  };
  // Mentions sous les cartes de lancement, adaptées au statut (le coût réel n'est pas
  // "2 crédits" pour un compte Découverte, dont la séance est offerte une seule fois).
  const miniNote = unlimited
    ? "Sans compter"
    : `${credits.costMiniscene} crédit${credits.costMiniscene > 1 ? "s" : ""}`;
  const seanceNote = unlimited
    ? "Sans compter"
    : !ent.entitledSub
      ? discoveryAvailable
        ? "1 séance offerte, à vie"
        : "Réservé aux abonnés"
      : `${credits.costSimulation} crédits`;

  const { framework, overall, categories, priorites } = detail;

  return (
    <div>
      <Link
        href="/catalogue"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-4 w-4" /> Tous les référentiels
      </Link>

      {/* Usage loyal : message courtois (jamais une erreur technique ni une coupure sèche). */}
      {fairuse && (
        <div className="mt-4 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-4 text-sm">
          {fairuse === "daily" ? (
            <p>
              Vous avez lancé beaucoup de mises en situation aujourd&apos;hui 🙌 Laissez-leur le
              temps d&apos;infuser et reprenez demain. Les exercices, eux, restent ouverts — et si
              vous avez besoin de plus, écrivez-moi à <b>contact@meleta.app</b>, on trouve une
              solution.
            </p>
          ) : (
            <p>
              Vous êtes parmi les praticiens les plus assidus ce mois-ci 🙌 Pour continuer sans
              attendre, écrivez-moi à <b>contact@meleta.app</b> — je débloque ça avec plaisir.
            </p>
          )}
        </div>
      )}

      {/* En-tête */}
      <div className="mt-3">
        <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--accent)]">
          {TYPE_LABEL[framework.type] ?? framework.type}
        </span>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{framework.nom}</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          Choisissez une façon de vous entraîner ci-dessous. Chaque essai met à jour votre
          carte de progression, plus bas.
        </p>
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

      {/* Première fois : guider le premier pas */}
      {overall.competencesCouvertes === 0 && (
        <div className="mt-6 flex flex-col items-start gap-3 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-5 sm:flex-row sm:items-center">
          <div className="flex-1">
            <h2 className="font-semibold">Première fois ici ?</h2>
            <p className="mt-0.5 text-sm text-[var(--muted)]">
              Commencez par un exercice — on choisit automatiquement le bon pour vous.
            </p>
          </div>
          <Link
            href={`/f/${framework.id}/entrainement`}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
          >
            <Dumbbell className="h-4 w-4" /> Commencer
          </Link>
        </div>
      )}

      {/* Comment s'entraîner : les 3 modes, du guidé à l'autonome */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Comment s&apos;entraîner&nbsp;?
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <ModeCard
            niveau="Débutant"
            titre="Exercices"
            desc="Une compétence à la fois, avec un feedback immédiat. Idéal pour débuter ou réviser."
            icon={<Dumbbell className="h-4 w-4" />}
          >
            <Link
              href={`/f/${framework.id}/entrainement`}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
            >
              S&apos;entraîner
            </Link>
          </ModeCard>

          <ModeCard
            niveau="Confirmé"
            titre="Mini-scène guidée"
            desc="Un court échange de quelques tours avec un patient, sur 2 compétences. Le pont vers la vraie pratique."
            icon={<Layers className="h-4 w-4" />}
          >
            <MiniSceneLauncher
              frameworkId={launch.frameworkId}
              total={launch.total}
              isUnlimited={launch.isUnlimited}
              costMini={credits.costMiniscene}
            />
            <CreditNote label={miniNote} />
          </ModeCard>

          <ModeCard
            niveau="Autonome"
            titre="Séance simulée"
            desc="Une séance complète, sans filet, débriefée à la fin. Pour éprouver votre autonomie."
            icon={<MessagesSquare className="h-4 w-4" />}
          >
            <SeanceLauncher
              frameworkId={launch.frameworkId}
              total={launch.total}
              isUnlimited={launch.isUnlimited}
              costSim={credits.costSimulation}
              entitledSub={launch.entitledSub}
              discoveryAvailable={launch.discoveryAvailable}
            />
            <CreditNote label={seanceNote} />
          </ModeCard>
        </div>
      </section>

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

      {/* Légende de la carte de progression */}
      <div className="mt-8 flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Vos compétences
        </h2>
        <p className="text-xs text-[var(--muted)]">
          Barre = niveau de maîtrise · points = à quel point c&apos;est pratiqué
        </p>
      </div>

      {/* Carte par catégorie */}
      <section className="mt-3 space-y-6">
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
                    <div className="w-10 shrink-0 text-right text-sm font-semibold">
                      {pct(c.mastery)}
                    </div>
                    <Link
                      href={`/f/${framework.id}/entrainement?competency=${c.id}`}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      title={`S'entraîner sur « ${c.nom} »`}
                    >
                      <Dumbbell className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">S&apos;entraîner</span>
                    </Link>
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

function CreditNote({ label }: { label: string }) {
  return (
    <p className="mt-1.5 flex items-center justify-center gap-1 text-[11px] text-[var(--muted)]">
      <Coins className="h-3 w-3 text-[var(--accent)]" /> {label}
    </p>
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

function ModeCard({
  niveau,
  titre,
  desc,
  icon,
  children,
}: {
  niveau: string;
  titre: string;
  desc: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-[var(--border)] bg-white p-4">
      <span className="self-start rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent)]">
        {niveau}
      </span>
      <div className="mt-2 flex items-center gap-2 font-semibold text-[var(--accent)]">
        {icon}
        <span className="text-[var(--foreground)]">{titre}</span>
      </div>
      <p className="mt-1 flex-1 text-xs text-[var(--muted)]">{desc}</p>
      <div className="mt-3 grid">{children}</div>
    </div>
  );
}
