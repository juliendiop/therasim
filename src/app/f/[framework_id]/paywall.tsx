// Vitrine d'un référentiel verrouillé (freemium B2C) : liste des compétences
// (l'incitatif), achat à l'unité (Stripe) et forfaits qui l'incluent.
// Server Component — rendu par la page référentiel quand l'utilisateur n'a pas accès.
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Lock, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { isStripeConfigured } from "@/lib/stripe";
import { TYPE_LABEL } from "@/lib/ui";
import { checkoutFrameworkAction } from "@/app/credits/actions";

export default async function FrameworkPaywall({
  frameworkId,
  success,
  canceled,
  error,
}: {
  frameworkId: string;
  success?: string;
  canceled?: string;
  error?: string;
}) {
  const framework = await prisma.framework.findUnique({ where: { id: frameworkId } });
  if (!framework) return null;

  const [competencies, categories, offer, planLinks] = await Promise.all([
    prisma.competency.findMany({
      where: { gridId: framework.gridId },
      orderBy: { ordre: "asc" },
    }),
    prisma.category.findMany({
      where: { gridId: framework.gridId },
      orderBy: { ordre: "asc" },
    }),
    prisma.frameworkOffer.findUnique({ where: { frameworkId } }),
    prisma.planFramework.findMany({ where: { frameworkId } }),
  ]);
  const plans =
    planLinks.length > 0
      ? await prisma.subscriptionPlan.findMany({
          where: { id: { in: planLinks.map((l) => l.planId) }, active: true },
          orderBy: { ordre: "asc" },
        })
      : [];
  const stripeReady = isStripeConfigured();
  const buyable = Boolean(offer?.active && offer.stripePriceId && stripeReady);
  const catNom = new Map(categories.map((c) => [c.code, c.nom]));

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/catalogue"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-4 w-4" /> Tous les domaines
      </Link>

      {success === "framework" && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          Paiement confirmé ✓ Ce domaine sera débloqué dans quelques instants (le temps que
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

      {/* L'incitatif : les compétences qu'on va apprendre */}
      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          <Sparkles className="h-4 w-4 text-[var(--ochre)]" />
          {competencies.length} compétences à travailler dans ce domaine
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

      {/* Débloquer */}
      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        {/* Achat à l'unité */}
        {offer?.active && (
          <div className="card-soft flex flex-col p-5">
            <div className="text-sm font-semibold">Débloquer ce domaine</div>
            <div className="mt-1 text-2xl font-bold">
              {(offer.priceEurCents / 100).toFixed(2).replace(".00", "")} €
              <span className="text-xs font-normal text-[var(--muted)]"> · une fois, accès à vie</span>
            </div>
            <p className="mt-1 flex-1 text-xs text-[var(--muted)]">
              Exercices illimités, mini-scènes et entretiens simulés (avec vos crédits), carte
              de progression dédiée.
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
                Paiement bientôt disponible pour ce domaine.
              </p>
            )}
          </div>
        )}

        {/* Via un forfait */}
        {plans.length > 0 && (
          <div className="card-soft flex flex-col p-5">
            <div className="text-sm font-semibold">Inclus dans les forfaits</div>
            <ul className="mt-2 flex-1 space-y-1.5 text-sm">
              {plans.map((p) => (
                <li key={p.id} className="flex items-center justify-between">
                  <span>{p.label}</span>
                  <span className="font-semibold">
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

        {/* Aucune option de déblocage configurée */}
        {!offer?.active && plans.length === 0 && (
          <div className="card-soft p-5 text-sm text-[var(--muted)] sm:col-span-2">
            Ce domaine sera bientôt disponible à l&apos;achat. Revenez prochainement !
          </div>
        )}
      </section>
    </div>
  );
}
