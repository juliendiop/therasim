import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Building2,
  Check,
  Coins,
  RefreshCw,
  Sparkles,
  Star,
} from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CREDIT_PACKS } from "@/lib/credits";
import { canBuyIndividualOffers } from "@/lib/entitlements";
import { isStripeConfigured } from "@/lib/stripe";
import { planQuotaLabel } from "@/lib/ui";
import { checkoutPackAction, checkoutPlanAction } from "@/app/credits/actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tarifs — MELETA",
  description:
    "Des forfaits d'abonnement avec crédits mensuels et domaines au choix, ou des packs de crédits à l'unité. Sans engagement, résiliable à tout moment.",
};

const FAQ: { q: string; a: string }[] = [
  {
    q: "Qu'est-ce qu'un crédit ?",
    a: "Un crédit est consommé à chaque mise en situation avec un patient simulé par IA (mini-scène ou entretien complet). Les exercices (QCM, reconnaissance) sont toujours gratuits et illimités, quel que soit votre forfait.",
  },
  {
    q: "Quelle différence entre un pack de crédits et un abonnement ?",
    a: "Un pack de crédits est un achat unique : les crédits s'ajoutent à votre solde et ne périment pas. Un abonnement est mensuel et récurrent : il recharge vos crédits chaque mois et vous donne accès à un ou plusieurs domaines cliniques au choix, en plus du domaine gratuit offert à l'inscription.",
  },
  {
    q: "Puis-je résilier à tout moment ?",
    a: "Oui. La résiliation se fait en un clic depuis votre espace (« Gérer mon abonnement »), sans justification ni délai. Vous gardez l'accès jusqu'à la fin de la période déjà payée.",
  },
  {
    q: "Y a-t-il un essai gratuit ?",
    a: "Tout inscrit débloque immédiatement un domaine clinique gratuit, avec exercices illimités et quelques crédits offerts pour tester les mises en situation — sans carte bancaire.",
  },
  {
    q: "Est-ce que je reçois une facture ?",
    a: "Oui, Stripe (notre prestataire de paiement) vous envoie automatiquement un reçu par email à chaque paiement, pack comme abonnement.",
  },
  {
    q: "Nous sommes une école ou un organisme de formation, comment ça marche ?",
    a: "Les écoles et organismes bénéficient d'un accès dédié pour l'ensemble de leurs apprenants, avec un tarif adapté au volume. Contactez-nous pour une démonstration et un devis.",
  },
];

export default async function TarifsPage() {
  const user = await getSessionUser();
  const [plans, freemium] = await Promise.all([
    prisma.subscriptionPlan.findMany({ where: { active: true }, orderBy: { ordre: "asc" } }),
    user ? canBuyIndividualOffers(user) : Promise.resolve(true),
  ]);
  const stripeReady = isStripeConfigured();

  return (
    <div className="animate-in mx-auto max-w-5xl">
      <section className="mx-auto max-w-2xl pt-4 text-center sm:pt-8">
        <span className="text-xs font-semibold uppercase tracking-widest text-[var(--ochre)]">
          Tarifs
        </span>
        <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Un forfait pour chaque rythme de pratique
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-[var(--ink-soft)]">
          Un domaine clinique gratuit dès l&apos;inscription. Ensuite, choisissez un
          abonnement mensuel ou rechargez vos crédits à l&apos;unité — sans engagement.
        </p>
      </section>

      {/* ---- Abonnements ---- */}
      <section className="mt-10">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          <RefreshCw className="h-3.5 w-3.5" /> Abonnements
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {plans.map((p) => {
            const highlighted = p.key === "praticien";
            return (
              <div
                key={p.id}
                className={`relative flex flex-col rounded-2xl border bg-white p-5 ${
                  highlighted
                    ? "border-[var(--accent)] shadow-md sm:scale-105"
                    : "border-[var(--border)]"
                }`}
              >
                {highlighted && (
                  <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-[var(--accent)] px-3 py-1 text-[11px] font-semibold text-white shadow-sm">
                    <Star className="h-3 w-3" /> Le plus choisi
                  </span>
                )}
                <div className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
                  {p.label}
                </div>
                <div className="mt-1.5 text-3xl font-bold">
                  {(p.priceEurCents / 100).toFixed(2).replace(".00", "")} €
                  <span className="text-sm font-normal text-[var(--muted)]">/mois</span>
                </div>
                <ul className="mt-3 flex-1 space-y-1.5 text-sm text-[var(--ink-soft)]">
                  <li className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                    {p.monthlyCredits} crédits chaque mois
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                    {planQuotaLabel(p.frameworkQuota)}
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                    Exercices illimités, sans engagement
                  </li>
                </ul>
                <div className="mt-4">
                  {!user ? (
                    <Link
                      href={`/inscription?plan=${p.id}`}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
                    >
                      S&apos;abonner <ArrowRight className="h-4 w-4" />
                    </Link>
                  ) : freemium ? (
                    <form action={checkoutPlanAction}>
                      <input type="hidden" name="planId" value={p.id} />
                      <button
                        disabled={!stripeReady || !p.stripePriceId}
                        className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
                      >
                        S&apos;abonner
                      </button>
                    </form>
                  ) : (
                    <div>
                      <button
                        disabled
                        className="w-full rounded-lg bg-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-500"
                      >
                        S&apos;abonner
                      </button>
                      <p className="mt-1.5 text-center text-[11px] text-[var(--muted)]">
                        Votre plateforme vous donne déjà accès à son catalogue.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---- Packs de crédits ---- */}
      <section className="mt-10">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          <Coins className="h-3.5 w-3.5" /> Packs de crédits
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Achat unique, sans abonnement. Les crédits ne périment pas.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {CREDIT_PACKS.map((p) => (
            <div
              key={p.id}
              className="flex flex-col rounded-2xl border border-[var(--border)] bg-white p-5 text-center"
            >
              <div className="text-3xl font-bold">{p.credits}</div>
              <div className="text-xs text-[var(--muted)]">crédits</div>
              <div className="mt-2 text-lg font-semibold">{p.priceEur} €</div>
              <div className="mt-4">
                {!user ? (
                  <Link
                    href="/inscription"
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                  >
                    Créer mon compte
                  </Link>
                ) : (
                  <form action={checkoutPackAction}>
                    <input type="hidden" name="packId" value={p.id} />
                    <button
                      disabled={!stripeReady}
                      className="w-full rounded-lg border border-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-50"
                    >
                      Acheter
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-center text-[11px] text-[var(--muted)]">
          Paiement sécurisé par Stripe.
        </p>
      </section>

      {/* ---- Écoles et organismes ---- */}
      <section className="mt-10">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-tint)] p-6 text-center sm:flex-row sm:text-left">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Building2 className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <h2 className="font-semibold">Écoles et organismes de formation</h2>
            <p className="mt-0.5 text-sm text-[var(--muted)]">
              Un accès dédié pour l&apos;ensemble de vos apprenants, avec un tarif adapté au
              volume. Contactez-nous pour une démonstration et un devis.
            </p>
          </div>
          <Link
            href="/demande-demo"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]"
          >
            Demander une démo <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ---- FAQ ---- */}
      <section className="mt-12 mb-10">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          <Sparkles className="h-3.5 w-3.5 text-[var(--ochre)]" /> Questions fréquentes
        </h2>
        <div className="mt-4 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-white">
          {FAQ.map((item) => (
            <div key={item.q} className="p-4">
              <h3 className="text-sm font-semibold">{item.q}</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Données structurées SEO : schema.org FAQPage. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: { "@type": "Answer", text: item.a },
            })),
          }),
        }}
      />
    </div>
  );
}
