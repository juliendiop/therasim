// Vitrine d'une SPÉCIALITÉ verrouillée : aperçu des compétences (l'incitatif), et
// selon le forfait — ouverture dans le quota, échange (swap) d'une spécialité contre
// une autre, achat à vie, ou montée en gamme. Le socle, lui, n'atterrit jamais ici :
// il est inclus partout. Server Component rendu par la page référentiel quand la
// spécialité n'est pas ouverte pour l'utilisateur.
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Lock, Repeat, Sparkles, Ticket } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { isStripeConfigured } from "@/lib/stripe";
import { subscriptionChoiceStatus } from "@/lib/entitlements";
import { TYPE_LABEL, planQuotaLabel } from "@/lib/ui";
import {
  activateFrameworkChoiceAction,
  swapFrameworkChoiceAction,
  checkoutFrameworkAction,
} from "@/app/credits/actions";

export default async function FrameworkPaywall({
  frameworkId,
  userId,
  success,
  canceled,
  error,
}: {
  frameworkId: string;
  userId: string;
  success?: string;
  canceled?: string;
  error?: string;
}) {
  const framework = await prisma.framework.findUnique({ where: { id: frameworkId } });
  if (!framework) return null;

  const [competencies, categories, offer, plans, status, choiceRows] = await Promise.all([
    prisma.competency.findMany({ where: { gridId: framework.gridId }, orderBy: { ordre: "asc" } }),
    prisma.category.findMany({ where: { gridId: framework.gridId }, orderBy: { ordre: "asc" } }),
    prisma.frameworkOffer.findUnique({ where: { frameworkId } }),
    prisma.subscriptionPlan.findMany({ where: { active: true }, orderBy: { ordre: "asc" } }),
    subscriptionChoiceStatus(userId),
    prisma.userFrameworkAccess.findMany({ where: { userId, source: "subscription_choice" } }),
  ]);
  const stripeReady = isStripeConfigured();
  const buyable = Boolean(offer?.active && offer.stripePriceId && stripeReady);
  const catNom = new Map(categories.map((c) => [c.code, c.nom]));

  const remaining = status.remaining;
  const canUseChoice = status.quota != null && (remaining ?? 0) > 0;
  const quotaReached = status.quota != null && (remaining ?? 0) <= 0;

  // Spécialités déjà choisies (pour l'échange), hors celle qu'on regarde.
  const dropCandidates = choiceRows.filter((r) => r.frameworkId !== frameworkId);
  const dropFrameworks =
    quotaReached && status.canSwap && dropCandidates.length > 0
      ? await prisma.framework.findMany({
          where: { id: { in: dropCandidates.map((r) => r.frameworkId) } },
          select: { id: true, nom: true },
        })
      : [];

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/catalogue"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-4 w-4" /> Toutes les spécialités
      </Link>

      {success === "framework" && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          Paiement confirmé ✓ Cette spécialité sera ouverte dans quelques instants (le temps que
          Stripe nous confirme la transaction) — rechargez la page.
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

      <div className="mt-4">
        <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--accent)]">
          {TYPE_LABEL[framework.type] ?? framework.type}
        </span>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Lock className="h-5 w-5 text-[var(--ochre)]" /> {framework.nom}
        </h1>
        {framework.description && (
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">{framework.description}</p>
        )}
      </div>

      {/* Quota disponible : ouverture en un clic */}
      {canUseChoice && (
        <div className="mt-5 flex flex-col items-start gap-3 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-5 sm:flex-row sm:items-center">
          <div className="flex-1">
            <div className="flex items-center gap-2 font-semibold">
              <Ticket className="h-4 w-4 text-[var(--accent)]" />
              Incluse dans votre forfait {status.planLabel}
            </div>
            <p className="mt-0.5 text-sm text-[var(--muted)]">
              Il vous reste {remaining} spécialité{(remaining ?? 0) > 1 ? "s" : ""} à choisir sur{" "}
              {status.quota}. Le socle, lui, est déjà inclus partout.
            </p>
          </div>
          <form action={activateFrameworkChoiceAction}>
            <input type="hidden" name="frameworkId" value={framework.id} />
            <button className="rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]">
              Ouvrir cette spécialité
            </button>
          </form>
        </div>
      )}

      {/* Quota atteint + échange autorisé : remplacer une spécialité par celle-ci */}
      {quotaReached && status.canSwap && dropFrameworks.length > 0 && (
        <div className="mt-5 rounded-xl border border-[var(--accent-border)] bg-white p-5">
          <div className="flex items-center gap-2 font-semibold">
            <Repeat className="h-4 w-4 text-[var(--accent)]" /> Échanger une spécialité
          </div>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            Votre forfait {status.planLabel} est à son quota ({status.quota}). Vous pouvez
            échanger une spécialité contre celle-ci, une fois par période. Votre progression sur
            la spécialité mise de côté est conservée et réapparaît si vous y revenez.
          </p>
          <form action={swapFrameworkChoiceAction} className="mt-3 flex flex-wrap items-center gap-2">
            <input type="hidden" name="addFrameworkId" value={framework.id} />
            <select
              name="dropFrameworkId"
              defaultValue=""
              required
              className="rounded-lg border border-[var(--border)] p-2 text-sm"
            >
              <option value="" disabled>
                Spécialité à remplacer…
              </option>
              {dropFrameworks.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nom}
                </option>
              ))}
            </select>
            <button className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]">
              Échanger
            </button>
          </form>
        </div>
      )}
      {quotaReached && !status.canSwap && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Votre forfait {status.planLabel} inclut {status.quota} spécialité
          {(status.quota ?? 0) > 1 ? "s" : ""} — quota atteint. Passez à un forfait supérieur pour
          en ouvrir davantage, ou débloquez cette spécialité à vie ci-dessous.
        </div>
      )}

      {/* L'incitatif : les compétences qu'on va travailler */}
      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          <Sparkles className="h-4 w-4 text-[var(--ochre)]" />
          {competencies.length} compétences à travailler dans cette spécialité
        </h2>
        <div className="mt-3 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-white">
          {competencies.map((c) => (
            <div key={c.id} className="flex items-start gap-3 px-4 py-3">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
              <div>
                <div className="font-medium">{c.nom}</div>
                <div className="text-xs text-[var(--muted)]">
                  {c.description || catNom.get(c.categoryCode) || ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Débloquer (paiement) */}
      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        {/* Achat à vie */}
        {offer?.active && (
          <div className="card-soft flex flex-col p-5">
            <div className="text-sm font-semibold">Débloquer cette spécialité à vie</div>
            <div className="mt-1 text-2xl font-bold">
              {(offer.priceEurCents / 100).toFixed(2).replace(".00", "")} €
              <span className="text-xs font-normal text-[var(--muted)]"> · une fois, accès à vie</span>
            </div>
            <p className="mt-1 flex-1 text-xs text-[var(--muted)]">
              Exercices illimités, mini-scènes et entretiens simulés (avec vos crédits), carte
              de progression dédiée. N&apos;entame pas votre quota de spécialités.
            </p>
            <form action={checkoutFrameworkAction} className="mt-3">
              <input type="hidden" name="frameworkId" value={framework.id} />
              <button
                disabled={!buyable}
                className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
              >
                Débloquer maintenant
              </button>
            </form>
            {!buyable && (
              <p className="mt-1.5 text-center text-[11px] text-[var(--muted)]">
                Paiement bientôt disponible pour cette spécialité.
              </p>
            )}
          </div>
        )}

        {/* Via un forfait (pour ouvrir plus de spécialités) */}
        {plans.length > 0 && !canUseChoice && (
          <div className="card-soft flex flex-col p-5">
            <div className="text-sm font-semibold">
              {status.entitledSub ? "Passer à un forfait supérieur" : "Avec un abonnement"}
            </div>
            <ul className="mt-2 flex-1 space-y-1.5 text-sm">
              {plans
                .filter((p) => p.priceEurCents > 0)
                .map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <span>
                      {p.label}
                      <span className="block text-xs text-[var(--muted)]">
                        {planQuotaLabel(p.frameworkQuota)}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold">
                      {(p.priceEurCents / 100).toFixed(2).replace(".00", "")} €
                      <span className="text-xs font-normal text-[var(--muted)]">/mois</span>
                    </span>
                  </li>
                ))}
            </ul>
            <Link
              href="/credits"
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]"
            >
              Voir les forfaits <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* Aucune option configurée */}
        {!offer?.active && plans.length === 0 && !canUseChoice && (
          <div className="card-soft p-5 text-sm text-[var(--muted)] sm:col-span-2">
            Cette spécialité sera bientôt disponible. Revenez prochainement !
          </div>
        )}
      </section>
    </div>
  );
}
