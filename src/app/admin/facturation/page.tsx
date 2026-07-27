import { CreditCard, Gift, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/config";
import { CREDIT_PACKS } from "@/lib/credits";
import { freeFrameworkIds } from "@/lib/entitlements";
import { isStripeConfigured } from "@/lib/stripe";
import { planQuotaLabel } from "@/lib/ui";
import {
  createPlan,
  savePackPriceIds,
  saveFrameworkOffer,
  saveFreeFrameworks,
  togglePlanActive,
  updatePlanPriceId,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function FacturationPage() {
  const [plans, packPriceIds, frameworks, offers, freeIds] = await Promise.all([
    prisma.subscriptionPlan.findMany({ orderBy: { ordre: "asc" } }),
    Promise.all(CREDIT_PACKS.map((p) => getConfig(`stripe.price.pack.${p.id}`))),
    prisma.framework.findMany({ where: { statut: "publie" }, orderBy: { nom: "asc" } }),
    prisma.frameworkOffer.findMany(),
    freeFrameworkIds(),
  ]);
  const keyConfigured = isStripeConfigured();
  const webhookConfigured = Boolean(process.env.STRIPE_WEBHOOK_SECRET);
  const offerByFramework = new Map(offers.map((o) => [o.frameworkId, o]));

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2">
        <CreditCard className="h-5 w-5 text-[var(--accent)]" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Facturation (Stripe)
        </h2>
      </div>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Packs de crédits (paiement unique) et forfaits d&apos;abonnement (récurrent
        mensuel). Créez les Prices correspondants dans le{" "}
        <a
          href="https://dashboard.stripe.com/products"
          target="_blank"
          rel="noreferrer"
          className="text-[var(--accent)] underline"
        >
          Dashboard Stripe
        </a>{" "}
        puis collez leur Price ID ci-dessous.
      </p>

      {/* Statut clés */}
      <div className="mt-3 space-y-2">
        <div
          className={`rounded-lg border p-3 text-sm ${
            keyConfigured
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-amber-300 bg-amber-50 text-amber-800"
          }`}
        >
          {keyConfigured
            ? "✓ Clé Stripe configurée (STRIPE_SECRET_KEY) — les paiements sont actifs."
            : "⚠️ Aucune clé Stripe (STRIPE_SECRET_KEY) : les paiements sont indisponibles."}
        </div>
        <div
          className={`rounded-lg border p-3 text-sm ${
            webhookConfigured
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-amber-300 bg-amber-50 text-amber-800"
          }`}
        >
          {webhookConfigured
            ? "✓ Webhook configuré (STRIPE_WEBHOOK_SECRET) — crédits/abonnements accordés automatiquement."
            : "⚠️ Aucun secret de webhook (STRIPE_WEBHOOK_SECRET) : les paiements réussiront mais rien ne sera accordé tant que le webhook n'est pas enregistré (voir 00_DEMARRAGE.md)."}
        </div>
      </div>

      {/* Packs de crédits */}
      <h3 className="mt-7 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        Packs de crédits (paiement unique)
      </h3>
      <form action={savePackPriceIds} className="mt-3 space-y-3">
        {CREDIT_PACKS.map((pack, i) => (
          <div
            key={pack.id}
            className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-white p-4 sm:flex-row sm:items-center"
          >
            <div className="w-40 shrink-0 text-sm">
              <b>{pack.credits}</b> crédits · {pack.priceEur} €
            </div>
            <input
              name={`price_${pack.id}`}
              defaultValue={packPriceIds[i] ?? ""}
              placeholder="price_..."
              className="flex-1 rounded-lg border border-[var(--border)] p-2 text-sm font-mono"
            />
          </div>
        ))}
        <button className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]">
          Enregistrer les Price ID
        </button>
      </form>

      {/* Forfaits d'abonnement */}
      <h3 className="mt-8 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        Forfaits d&apos;abonnement (récurrent mensuel)
      </h3>
      {plans.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--muted)]">Aucun forfait pour l&apos;instant.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-xl border bg-white p-4 ${
                plan.active ? "border-[var(--border)]" : "border-dashed border-[var(--border)] opacity-60"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-semibold">{plan.label}</span>{" "}
                  <span className="text-xs text-[var(--muted)]">({plan.key})</span>
                  <div className="text-xs text-[var(--muted)]">
                    {(plan.priceEurCents / 100).toFixed(2)} € / mois · {plan.monthlyCredits}{" "}
                    crédits/mois · {planQuotaLabel(plan.frameworkQuota)}{" "}
                    {!plan.active && "· inactif"}
                  </div>
                </div>
                <form action={togglePlanActive}>
                  <input type="hidden" name="id" value={plan.id} />
                  <button className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:border-[var(--accent)]">
                    {plan.active ? "Désactiver" : "Activer"}
                  </button>
                </form>
              </div>
              <form action={updatePlanPriceId} className="mt-2 flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={plan.id} />
                <input
                  name="stripePriceId"
                  defaultValue={plan.stripePriceId ?? ""}
                  placeholder="price_... (récurrent)"
                  className="min-w-40 flex-1 rounded-lg border border-[var(--border)] p-2 text-xs font-mono"
                />
                <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                  Spécialités
                  <input
                    name="frameworkQuota"
                    type="number"
                    min={1}
                    defaultValue={plan.frameworkQuota ?? ""}
                    placeholder="toutes"
                    className="w-16 rounded-lg border border-[var(--border)] p-2 text-xs"
                  />
                </label>
                <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                  Crédits/mois
                  <input
                    name="monthlyCredits"
                    type="number"
                    min={0}
                    defaultValue={plan.monthlyCredits ?? ""}
                    placeholder="sans compter"
                    className="w-20 rounded-lg border border-[var(--border)] p-2 text-xs"
                  />
                </label>
                <button className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:border-[var(--accent)]">
                  Mettre à jour
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      {/* Créer un forfait */}
      <h4 className="mt-6 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        Nouveau forfait
      </h4>
      <form action={createPlan} className="mt-2 grid gap-2 rounded-xl border border-[var(--border)] bg-white p-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium">Clé (interne)</label>
          <input name="key" required placeholder="praticien" className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium">Nom affiché</label>
          <input name="label" required placeholder="Praticien" className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium">Crédits accordés / mois</label>
          <input name="monthlyCredits" type="number" min={0} placeholder="vide = sans compter" className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium">Prix (€ / mois)</label>
          <input name="priceEur" type="number" min={0} step="0.01" required className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium">
            Spécialités au choix de l&apos;abonné (vide = toutes les spécialités)
          </label>
          <input
            name="frameworkQuota"
            type="number"
            min={1}
            placeholder="ex. 1 pour Essentiel, 3 pour Praticien, vide pour Intensif"
            className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
          />
          <p className="mt-1 text-[11px] text-[var(--muted)]">
            L&apos;abonné débloque lui-même les domaines qui l&apos;intéressent, dans la
            limite de ce quota. Choix définitifs tant qu&apos;il est abonné (pas d&apos;échange).
          </p>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium">Price ID Stripe (optionnel — peut être ajouté après coup)</label>
          <input name="stripePriceId" placeholder="price_..." className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm font-mono" />
        </div>
        <button className="sm:col-span-2 mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]">
          <Plus className="h-4 w-4" /> Créer le forfait
        </button>
      </form>

      {/* Référentiels gratuits à l'inscription (freemium) */}
      <h3 className="mt-8 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        <Gift className="h-4 w-4" /> Gratuits à l&apos;inscription
      </h3>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Domaines accessibles à tout inscrit du site public, sans paiement. Les autres
        apparaissent verrouillés (vitrine incitative) jusqu&apos;à abonnement ou achat.
        Les plateformes clientes (B2B) ne sont pas concernées.
      </p>
      <form action={saveFreeFrameworks} className="mt-3 rounded-xl border border-[var(--border)] bg-white p-4">
        <div className="flex flex-wrap gap-3">
          {frameworks.map((f) => (
            <label key={f.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="free"
                value={f.id}
                defaultChecked={freeIds.has(f.id)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              {f.nom}
            </label>
          ))}
        </div>
        <button className="mt-3 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]">
          Enregistrer les gratuits
        </button>
      </form>

      {/* Achat à l'unité par référentiel */}
      <h3 className="mt-8 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        Référentiels à l&apos;unité (paiement unique, accès à vie)
      </h3>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Pour chaque domaine payant : prix affiché + Price ID Stripe (one-time). Un domaine
        sans offre active n&apos;est achetable que via un forfait.
      </p>
      <div className="mt-3 space-y-2">
        {frameworks.map((f) => {
          const offer = offerByFramework.get(f.id);
          return (
            <form
              key={f.id}
              action={saveFrameworkOffer}
              className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-white p-4 sm:flex-row sm:items-center"
            >
              <input type="hidden" name="frameworkId" value={f.id} />
              <div className="w-44 shrink-0 text-sm font-medium">{f.nom}</div>
              <div className="flex items-center gap-1.5">
                <input
                  name="priceEur"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={offer ? (offer.priceEurCents / 100).toFixed(2) : ""}
                  placeholder="49"
                  className="w-24 rounded-lg border border-[var(--border)] p-2 text-sm"
                />
                <span className="text-xs text-[var(--muted)]">€</span>
              </div>
              <input
                name="stripePriceId"
                defaultValue={offer?.stripePriceId ?? ""}
                placeholder="price_... (one-time)"
                className="flex-1 rounded-lg border border-[var(--border)] p-2 text-xs font-mono"
              />
              <label className="flex shrink-0 items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={offer?.active ?? true}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                en vente
              </label>
              <button className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:border-[var(--accent)]">
                Enregistrer
              </button>
            </form>
          );
        })}
      </div>
    </div>
  );
}
