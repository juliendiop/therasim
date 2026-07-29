import Link from "next/link";
import { ArrowLeft, Coins, History, RefreshCw, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCreditPacks, creditSettings, syncWallet, syncSubscriptionCredits, getWalletView } from "@/lib/credits";
import { canBuyIndividualOffers, isSubscriptionEntitled } from "@/lib/entitlements";
import { resolveCommissionRate } from "@/lib/affiliation";
import { palier, palierRank, PALIER_LABEL, type Palier } from "@/lib/mastery";
import { isStripeConfigured } from "@/lib/stripe";
import { planQuotaLabel, monthlyCreditsLabel } from "@/lib/ui";
import AffiliationNudge from "@/app/_components/affiliation-nudge";
import { checkoutPackAction, checkoutPlanAction, manageBillingAction } from "./actions";

export const dynamic = "force-dynamic";

const REASON_LABEL: Record<string, string> = {
  welcome: "Pack de bienvenue",
  monthly: "Recharge mensuelle",
  consume_miniscene: "Mini-scène",
  consume_simulation: "Séance simulée",
  refund: "Remboursement",
  admin_grant: "Crédits offerts",
  purchase: "Achat de crédits",
  subscription_renewal: "Renouvellement d'abonnement",
};

const SUBSCRIPTION_STATUS_LABEL: Record<string, string> = {
  active: "actif",
  past_due: "paiement en retard",
  canceled: "résilié",
  incomplete: "en attente de paiement",
};

export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<{
    need?: string;
    success?: string;
    canceled?: string;
    error?: string;
    fw?: string;
  }>;
}) {
  const user = await requireUser();
  const { need, success, canceled, error, fw } = await searchParams;
  const stripeReady = isStripeConfigured();

  // Allocation du forfait (essai inclus) avant la lecture du solde, et avant le
  // plancher freemium appliqué par syncWallet.
  await syncSubscriptionCredits(user.id);
  // Détail du solde : portefeuille persistant vs allocation de forfait (non reportée).
  const walletView = await getWalletView(user.id);

  const [balance, settings, history, plans, subscription, freemium, rates, packs] =
    await Promise.all([
      syncWallet(user.id),
      creditSettings(),
      prisma.creditLedger.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.subscriptionPlan.findMany({ where: { active: true }, orderBy: { ordre: "asc" } }),
      prisma.userSubscription.findUnique({ where: { userId: user.id } }),
      canBuyIndividualOffers(user),
      resolveCommissionRate(),
      getCreditPacks(),
    ]);
  // La recharge par pack est RÉSERVÉE aux abonnés (un compte Découverte passe à
  // l'abonnement, il ne recharge pas).
  const canRecharge = Boolean(subscription && isSubscriptionEntitled(subscription.status));

  // Écran dédié "plus de crédits" (need défini) : récap de progression + le
  // forfait Praticien (recommandé) + un lien de retour vers le référentiel visé.
  const [progress, recommendedPlan, fwName] = need
    ? await Promise.all([
        prisma.userCompetencyState
          .findMany({ where: { userId: user.id }, select: { mastery: true } })
          .then((rows) => {
            const practiced = rows.filter((r) => r.mastery !== null);
            let best: Palier = "non_pratique";
            for (const r of practiced) {
              const p = palier(r.mastery);
              if (palierRank(p) > palierRank(best)) best = p;
            }
            return { count: practiced.length, bestPalier: best };
          }),
        prisma.subscriptionPlan.findFirst({ where: { key: "praticien", active: true } }),
        fw
          ? prisma.framework.findUnique({ where: { id: fw }, select: { nom: true } }).then((f) => f?.nom ?? null)
          : Promise.resolve(null),
      ])
    : [null, null, null];
  const recommendedPack = packs[0] ?? null;
  const activePlan = subscription
    ? plans.find((p) => p.id === subscription.planId) ??
      (await prisma.subscriptionPlan.findUnique({ where: { id: subscription.planId } }))
    : null;
  // Règle d'AFFICHAGE (« ai-je un abonnement à gérer ? »), volontairement plus large
  // que l'entitlement : un `past_due` doit continuer à voir son bloc d'abonnement et
  // le bouton de gestion. Ne pas remplacer par isSubscriptionEntitled() — ce serait
  // un changement de comportement pour past_due/incomplete. `trialing` passe déjà ici.
  const hasActiveSubscription = subscription && subscription.status !== "canceled";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-2">
        <Coins className="h-5 w-5 text-[var(--accent)]" />
        <h1 className="text-xl font-semibold">Mes crédits</h1>
      </div>

      {/* Séance complète « découverte » déjà utilisée : explication + abonnement
          (jamais une erreur technique). La séance N3 sur le gratuit est unique. */}
      {need === "discovery" && (
        <div className="mt-4 rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-5">
          <h2 className="font-semibold">Vous avez utilisé votre séance complète découverte</h2>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Le compte gratuit inclut <b>une séance complète</b>, offerte une fois — vous
            l&apos;avez fait, bravo. Les <b>exercices</b> et les <b>mini-scènes</b> restent
            ouverts sur toutes vos spécialités. Pour enchaîner les séances complètes, un
            abonnement les débloque (2 crédits chacun).
          </p>
          {fwName && (
            <Link
              href={`/f/${fw}`}
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)] hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Retourner à « {fwName} »
            </Link>
          )}
          {freemium && recommendedPlan && (
            <div className="mt-4 rounded-xl border border-[var(--accent)] bg-white p-4 sm:max-w-xs">
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
                {recommendedPlan.label}
              </div>
              <div className="mt-1 text-2xl font-bold">
                {(recommendedPlan.priceEurCents / 100).toFixed(2).replace(".00", "")} €
                <span className="text-sm font-normal text-[var(--muted)]">/mois</span>
              </div>
              <div className="text-sm text-[var(--muted)]">
                Séances complètes débloquées · socle + 3 spécialités
              </div>
              <form action={checkoutPlanAction} className="mt-3">
                <input type="hidden" name="planId" value={recommendedPlan.id} />
                <button
                  disabled={!stripeReady || !recommendedPlan.stripePriceId}
                  className="w-full rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
                >
                  S&apos;abonner
                </button>
              </form>
            </div>
          )}
          <p className="mt-3 text-xs text-[var(--muted)]">
            <Link href="/tarifs" className="font-medium text-[var(--accent)] hover:underline">
              Voir tous les forfaits
            </Link>
          </p>
        </div>
      )}

      {/* Écran dédié "plus de crédits" (pas une erreur générique) : récap de
          progression + 2 CTA directs vers le checkout. */}
      {need && need !== "discovery" && (
        <div className="mt-4 rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-5">
          <h2 className="font-semibold">
            Il vous manque des crédits pour{" "}
            {need === "simulation" ? "lancer cette séance simulée" : "lancer cette mini-scène"}
          </h2>
          {progress && (
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              Vous avez déjà travaillé <b>{progress.count}</b> compétence
              {progress.count > 1 ? "s" : ""}
              {progress.bestPalier !== "non_pratique" && (
                <>
                  {" "}
                  — palier <b>{PALIER_LABEL[progress.bestPalier]}</b> atteint sur votre
                  meilleure compétence
                </>
              )}
              . Ne vous arrêtez pas en si bon chemin !
            </p>
          )}
          {fwName && (
            <Link
              href={`/f/${fw}`}
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)] hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Retourner à « {fwName} »
            </Link>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {/* Pack recommandé : réservé aux abonnés (recharge). */}
            {canRecharge && recommendedPack && (
              <div className="rounded-xl border border-[var(--border)] bg-white p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                  Reprise rapide
                </div>
                <div className="mt-1 text-2xl font-bold">
                  {recommendedPack.credits}{" "}
                  <span className="text-sm font-normal text-[var(--muted)]">crédits</span>
                </div>
                <div className="text-sm font-semibold">
                  {(recommendedPack.priceEurCents / 100).toFixed(2).replace(".00", "")} €
                </div>
                <form action={checkoutPackAction} className="mt-3">
                  <input type="hidden" name="packId" value={recommendedPack.id} />
                  <button
                    disabled={!stripeReady}
                    className="w-full rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
                  >
                    Recharger maintenant
                  </button>
                </form>
              </div>
            )}

            {/* Forfait Praticien : proposé uniquement aux comptes éligibles aux
                abonnements (pas aux membres B2B sans opt-in). */}
            {freemium && recommendedPlan && (
              <div className="rounded-xl border border-[var(--accent)] bg-white p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
                  {recommendedPlan.label}
                </div>
                <div className="mt-1 text-2xl font-bold">
                  {(recommendedPlan.priceEurCents / 100).toFixed(2).replace(".00", "")} €
                  <span className="text-sm font-normal text-[var(--muted)]">/mois</span>
                </div>
                <div className="text-sm text-[var(--muted)]">
                  {monthlyCreditsLabel(recommendedPlan.monthlyCredits)}
                </div>
                <form action={checkoutPlanAction} className="mt-3">
                  <input type="hidden" name="planId" value={recommendedPlan.id} />
                  <button
                    disabled={!stripeReady || !recommendedPlan.stripePriceId}
                    className="w-full rounded-lg border border-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-50"
                  >
                    S&apos;abonner
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
      {success && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          Paiement confirmé ✓ {success === "plan" ? "Votre abonnement" : "Vos crédits"} seront
          actifs dans quelques instants (le temps que Stripe nous confirme la transaction).
        </div>
      )}
      {canceled && (
        <div className="mt-4 rounded-xl border border-[var(--border)] bg-gray-50 p-4 text-sm text-[var(--muted)]">
          Paiement annulé — rien n&apos;a été débité.
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {!stripeReady && (
        <div className="mt-4 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-4 text-sm">
          Le paiement en ligne arrive très bientôt. En attendant, votre administrateur peut
          créditer votre compte — n&apos;hésitez pas à le contacter.
        </div>
      )}

      {/* Solde */}
      <div className="mt-4 flex items-center justify-between rounded-xl border border-[var(--border)] bg-white p-5">
        <div>
          <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Solde actuel</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-[var(--accent)]">{balance}</span>
            <span className="text-sm text-[var(--muted)]">crédit{balance > 1 ? "s" : ""}</span>
          </div>
          {walletView.plan > 0 && (
            <p className="mt-1 text-xs text-[var(--muted)]">
              dont <b>{walletView.plan}</b> de forfait ce mois-ci — non reportés au mois
              suivant. Vos crédits achetés ({walletView.wallet}) restent acquis.
            </p>
          )}
        </div>
        <div className="text-right text-xs text-[var(--muted)]">
          <p>Mini-scène : <b>{settings.costMiniscene}</b> crédit{settings.costMiniscene > 1 ? "s" : ""}</p>
          <p>Séance simulée : <b>{settings.costSimulation}</b> crédits</p>
          <p className="mt-1">Exercices (QCM) : <b>gratuits</b></p>
        </div>
      </div>

      {/* Recharge mensuelle */}
      <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--muted)]">
        <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
        {settings.welcome} crédits offerts à l&apos;inscription, puis {settings.monthly} crédits
        gratuits chaque mois. Le socle et une spécialité de votre choix sont inclus dès le
        compte gratuit.
      </p>

      {/* Abonnement en cours */}
      {hasActiveSubscription && (
        <div className="mt-6 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">
                Abonnement {activePlan?.label ?? ""} —{" "}
                {SUBSCRIPTION_STATUS_LABEL[subscription!.status] ?? subscription!.status}
              </div>
              {subscription!.currentPeriodEnd && (
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {subscription!.cancelAtPeriodEnd
                    ? "Résiliation programmée au "
                    : "Prochain renouvellement le "}
                  {subscription!.currentPeriodEnd.toLocaleDateString("fr-FR", {
                    timeZone: "Europe/Paris",
                  })}
                </p>
              )}
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                Le socle est inclus partout ; votre forfait ouvre des spécialités au choix —
                ouvrez-les ou échangez-les depuis le catalogue.
              </p>
            </div>
            <form action={manageBillingAction}>
              <button className="rounded-lg border border-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent)] hover:bg-white">
                Gérer mon abonnement
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Programme ambassadeur : rappel discret pour un utilisateur éligible et
          engagé (il consulte déjà ses crédits/abonnement). Masqué sur l'écran
          dédié "plus de crédits" pour ne pas détourner de la reprise. */}
      {!need && freemium && rates.enabled && (
        <div className="mt-6">
          <AffiliationNudge rateTier1={rates.rateTier1} />
        </div>
      )}

      {/* Forfaits d'abonnement — réservés au site public (les membres des
          plateformes clientes ont déjà tout le catalogue de leur plateforme).
          Masqué quand l'écran dédié "plus de crédits" est affiché (ci-dessus). */}
      {!need && freemium && plans.length > 0 && !hasActiveSubscription && (
        <>
          <h2 className="mt-7 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            <RefreshCw className="h-3.5 w-3.5" /> S&apos;abonner
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {plans.filter((p) => p.priceEurCents > 0).map((p) => (
              <div
                key={p.id}
                className="flex flex-col rounded-xl border border-[var(--border)] bg-white p-4"
              >
                <div className="font-semibold">{p.label}</div>
                <div className="mt-1 text-2xl font-bold">
                  {(p.priceEurCents / 100).toFixed(2).replace(".00", "")} €
                  <span className="text-xs font-normal text-[var(--muted)]">/mois</span>
                </div>
                <div className="mt-1 flex-1 text-xs text-[var(--muted)]">
                  {monthlyCreditsLabel(p.monthlyCredits)} · <b>{planQuotaLabel(p.frameworkQuota)}</b>
                </div>
                <form action={checkoutPlanAction} className="mt-3">
                  <input type="hidden" name="planId" value={p.id} />
                  <button
                    disabled={!stripeReady || !p.stripePriceId}
                    className="w-full rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
                  >
                    S&apos;abonner
                  </button>
                </form>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Recharge par pack — RÉSERVÉE aux abonnés (Découverte passe à l'abonnement).
          Masqué sur l'écran dédié "plus de crédits" (ci-dessus, son propre CTA). */}
      {!need && canRecharge && packs.length > 0 && (
        <>
          <h2 className="mt-7 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Recharger
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {packs.map((p) => (
              <div
                key={p.id}
                className="flex flex-col rounded-xl border border-[var(--border)] bg-white p-4 text-center"
              >
                <div className="text-2xl font-bold">{p.credits}</div>
                <div className="text-xs text-[var(--muted)]">crédits</div>
                <div className="mt-2 text-sm font-semibold">
                  {(p.priceEurCents / 100).toFixed(2).replace(".00", "")} €
                </div>
                <form action={checkoutPackAction} className="mt-3">
                  <input type="hidden" name="packId" value={p.id} />
                  <button
                    disabled={!stripeReady || !p.stripePriceId}
                    className="w-full rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
                  >
                    Acheter
                  </button>
                </form>
              </div>
            ))}
          </div>
          <p className="mt-2 text-center text-[11px] text-[var(--muted)]">
            Paiement sécurisé par Stripe.
          </p>
        </>
      )}

      {/* Historique */}
      <h2 className="mt-7 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        <History className="h-4 w-4" /> Historique
      </h2>
      {history.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">Aucun mouvement pour l&apos;instant.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-[var(--border)]">
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="px-4 py-2">{REASON_LABEL[h.reason] ?? h.reason}</td>
                  <td className="px-4 py-2 text-xs text-[var(--muted)]">
                    {h.createdAt.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}
                  </td>
                  <td
                    className={`px-4 py-2 text-right font-semibold ${
                      h.delta >= 0 ? "text-green-700" : "text-[var(--foreground)]"
                    }`}
                  >
                    {h.delta >= 0 ? `+${h.delta}` : h.delta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
