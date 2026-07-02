import { Coins, History, RefreshCw, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CREDIT_PACKS, creditSettings, syncWallet } from "@/lib/credits";
import { isStripeConfigured } from "@/lib/stripe";
import { checkoutPackAction, checkoutPlanAction, manageBillingAction } from "./actions";

export const dynamic = "force-dynamic";

const REASON_LABEL: Record<string, string> = {
  welcome: "Pack de bienvenue",
  monthly: "Recharge mensuelle",
  consume_miniscene: "Mini-scène",
  consume_simulation: "Entretien simulé",
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
  searchParams: Promise<{ need?: string; success?: string; canceled?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { need, success, canceled, error } = await searchParams;
  const stripeReady = isStripeConfigured();

  const [balance, settings, history, plans, subscription] = await Promise.all([
    syncWallet(user.id),
    creditSettings(),
    prisma.creditLedger.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.subscriptionPlan.findMany({ where: { active: true }, orderBy: { ordre: "asc" } }),
    prisma.userSubscription.findUnique({ where: { userId: user.id } }),
  ]);
  const activePlan = subscription
    ? plans.find((p) => p.id === subscription.planId) ??
      (await prisma.subscriptionPlan.findUnique({ where: { id: subscription.planId } }))
    : null;
  const hasActiveSubscription = subscription && subscription.status !== "canceled";
  // Quota de domaines du forfait actif (affichage « X/N choisis »).
  const usedChoices = hasActiveSubscription
    ? await prisma.userFrameworkAccess.count({
        where: { userId: user.id, source: "subscription_choice" },
      })
    : 0;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-2">
        <Coins className="h-5 w-5 text-[var(--accent)]" />
        <h1 className="text-xl font-semibold">Mes crédits</h1>
      </div>

      {need && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Vous n&apos;avez plus assez de crédits pour lancer{" "}
          {need === "simulation" ? "un entretien simulé" : "une mini-scène"}. Rechargez votre
          solde pour continuer à vous entraîner.
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
        </div>
        <div className="text-right text-xs text-[var(--muted)]">
          <p>Mini-scène : <b>{settings.costMiniscene}</b> crédit{settings.costMiniscene > 1 ? "s" : ""}</p>
          <p>Entretien simulé : <b>{settings.costSimulation}</b> crédits</p>
          <p className="mt-1">Exercices (QCM) : <b>gratuits</b></p>
        </div>
      </div>

      {/* Recharge mensuelle */}
      <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--muted)]">
        <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
        Vous recevez {settings.monthly} crédits gratuits chaque mois.
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
              {activePlan && activePlan.frameworkQuota != null && (
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  Domaines choisis : {usedChoices}/{activePlan.frameworkQuota}
                  {usedChoices < activePlan.frameworkQuota &&
                    " — débloquez-en depuis le catalogue."}
                </p>
              )}
            </div>
            <form action={manageBillingAction}>
              <button className="rounded-lg border border-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent)] hover:bg-white">
                Gérer mon abonnement
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Forfaits d'abonnement */}
      {plans.length > 0 && !hasActiveSubscription && (
        <>
          <h2 className="mt-7 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            <RefreshCw className="h-3.5 w-3.5" /> S&apos;abonner
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {plans.map((p) => (
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
                  {p.monthlyCredits} crédits chaque mois ·{" "}
                  <b>
                    {p.frameworkQuota == null
                      ? "tout le catalogue de domaines"
                      : `${p.frameworkQuota} domaine${p.frameworkQuota > 1 ? "s" : ""} au choix`}
                  </b>
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

      {/* Packs de crédits (achat unique) */}
      <h2 className="mt-7 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        Recharger
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {CREDIT_PACKS.map((p) => (
          <div
            key={p.id}
            className="flex flex-col rounded-xl border border-[var(--border)] bg-white p-4 text-center"
          >
            <div className="text-2xl font-bold">{p.credits}</div>
            <div className="text-xs text-[var(--muted)]">crédits</div>
            <div className="mt-2 text-sm font-semibold">{p.priceEur} €</div>
            <form action={checkoutPackAction} className="mt-3">
              <input type="hidden" name="packId" value={p.id} />
              <button
                disabled={!stripeReady}
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

      {/* Historique */}
      <h2 className="mt-7 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        <History className="h-4 w-4" /> Historique
      </h2>
      {history.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">Aucun mouvement pour l&apos;instant.</p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)] bg-white">
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
