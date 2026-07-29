import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Building2, MapPin, ShieldCheck } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { creditSettings } from "@/lib/credits";
import { canBuyIndividualOffers } from "@/lib/entitlements";
import { resolveCommissionRate } from "@/lib/affiliation";
import { isStripeConfigured } from "@/lib/stripe";
import Track from "@/app/_components/track";
import AffiliationNudge from "@/app/_components/affiliation-nudge";
import PricingGrid, { type PricingPlan } from "./pricing-grid";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tarifs — MELETA",
  description:
    "Le socle clinique est inclus dans tous les niveaux, gratuit compris. Les forfaits ouvrent des spécialités au choix et augmentent le nombre de mises en situation par mois. Sans engagement, résiliable à tout moment.",
};

const FAQ: { q: string; a: string }[] = [
  {
    q: "Qu'est-ce qu'un crédit ?",
    a: "Un crédit est consommé à chaque mise en situation avec un patient simulé par IA : 1 crédit pour une mini-scène, 2 pour une séance complète. Les exercices (QCM, reconnaissance) ne consomment jamais de crédit.",
  },
  {
    q: "Qu'est-ce qui est illimité ?",
    a: "Les exercices (niveau 1) sont illimités pour tout le monde, gratuit compris, sur toutes vos spécialités accessibles. Seules les mises en situation avec un patient simulé consomment des crédits — sauf sur le forfait Intensif, où elles sont sans compter.",
  },
  {
    q: "Quelle différence entre le socle et une spécialité ?",
    a: "Le socle regroupe les fondamentaux de l'entretien clinique : il est inclus dans tous les niveaux, y compris le compte gratuit, sans jamais entamer votre quota. Les spécialités sont les domaines plus ciblés ; chaque forfait en ouvre un certain nombre, à votre choix.",
  },
  {
    q: "Comment change-t-on de spécialité, et à quelle fréquence ?",
    a: "Sur Essentiel et Praticien, vous pouvez échanger une spécialité déjà choisie contre une autre, une fois par période de facturation, depuis la page du domaine. L'échange est immédiat.",
  },
  {
    q: "Que devient ma progression sur une spécialité que j'abandonne ?",
    a: "Elle est intégralement conservée. Si vous revenez plus tard sur cette spécialité, vous retrouvez votre carte de progression telle que vous l'aviez laissée — rien n'est supprimé.",
  },
  {
    q: "Que veut dire « sans compter » sur le forfait Intensif ?",
    a: "Sur Intensif, les mises en situation ne décomptent aucun crédit : vous vous entraînez autant que vous le souhaitez, sans surveiller un solde.",
  },
  {
    q: "Les crédits se reportent-ils d'un mois sur l'autre ?",
    a: "Non. Les crédits d'un forfait sont une allocation mensuelle, remise à sa valeur chaque mois ; le solde non utilisé n'est pas reporté. À la fin de l'abonnement, cette allocation revient à zéro.",
  },
  {
    q: "Puis-je résilier à tout moment ?",
    a: "Oui. La résiliation se fait en un clic depuis votre espace (« Gérer mon abonnement »), sans justification ni délai. Vous gardez l'accès jusqu'à la fin de la période déjà payée.",
  },
  {
    q: "Est-ce que je reçois une facture ?",
    a: "Oui. Stripe, notre prestataire de paiement, vous envoie automatiquement un reçu par email à chaque paiement, mensuel comme annuel.",
  },
  {
    q: "Puis-je changer de forfait en cours de mois ?",
    a: "Oui. Une montée en gamme est immédiate — vos spécialités et vos crédits s'ajustent tout de suite, et Stripe calcule le prorata. Une baisse de forfait s'applique au renouvellement suivant.",
  },
  {
    q: "Que se passe-t-il quand un nouveau référentiel sort ?",
    a: "Le catalogue s'enrichit régulièrement. Un nouveau référentiel du socle devient accessible à tous ; une nouvelle spécialité peut être ouverte dans votre quota, ou par échange sur Essentiel et Praticien. Nous n'incluons pas automatiquement tous les référentiels futurs dans un forfait donné.",
  },
  {
    q: "Nous sommes une école ou un organisme de formation ?",
    a: "Les écoles et organismes bénéficient d'un accès dédié pour l'ensemble de leurs apprenants, avec un tarif adapté au volume. Contactez-nous pour une démonstration et un devis.",
  },
];

export default async function TarifsPage() {
  const user = await getSessionUser();
  const [plans, settings, freemium, rates] = await Promise.all([
    prisma.subscriptionPlan.findMany({
      where: { active: true },
      orderBy: [{ priceEurCents: "asc" }, { ordre: "asc" }],
    }),
    creditSettings(),
    user ? canBuyIndividualOffers(user) : Promise.resolve(true),
    resolveCommissionRate(),
  ]);
  const stripeReady = isStripeConfigured();

  const pricingPlans: PricingPlan[] = plans.map((p) => ({
    id: p.id,
    key: p.key,
    label: p.label,
    priceEurCents: p.priceEurCents,
    monthlyCredits: p.monthlyCredits,
    frameworkQuota: p.frameworkQuota,
    stripePriceId: p.stripePriceId,
    stripePriceIdYearly: p.stripePriceIdYearly,
  }));

  // Argument affiliation : question FAQ visible pour tous (SEO) ; le bandeau n'est
  // proposé qu'aux utilisateurs connectés éligibles. Taux lus depuis AppConfig.
  const faq = rates.enabled
    ? [
        ...FAQ,
        {
          q: "Puis-je gagner de l'argent en recommandant MELETA ?",
          a: `Oui. Le programme ambassadeur, gratuit et sans engagement, vous permet de toucher ${rates.rateTier1} % de commission sur chaque abonnement souscrit via votre lien de parrainage — versé tant que la personne reste abonnée. Vous suivez vos filleuls et vos revenus depuis votre espace, et demandez le paiement dès ${(rates.payoutMinCents / 100).toFixed(2).replace(".00", "")} € de solde.`,
        },
      ]
    : FAQ;
  const showAffiliationBand = Boolean(user) && freemium && rates.enabled;

  return (
    <div className="animate-in mx-auto max-w-5xl">
      <Track event="landing_view" path="/tarifs" />
      <section className="mx-auto max-w-2xl pt-4 text-center sm:pt-8">
        <span className="text-xs font-semibold uppercase tracking-widest text-[var(--ochre)]">
          Tarifs
        </span>
        <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Un forfait pour chaque rythme de pratique
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-[var(--ink-soft)]">
          Le socle clinique est inclus dans tous les niveaux, gratuit compris. Les forfaits
          ouvrent des spécialités et augmentent le nombre de mises en situation par mois.
        </p>
      </section>

      {/* ---- Grille (client : bascule mensuel/annuel) ---- */}
      <section className="mt-8">
        <PricingGrid
          plans={pricingPlans}
          costMiniscene={settings.costMiniscene}
          costSimulation={settings.costSimulation}
          isLoggedIn={Boolean(user)}
          canSubscribe={freemium}
          stripeReady={stripeReady}
        />
      </section>

      {/* ---- Données & confiance ---- */}
      <section className="mt-10">
        <div className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-tint)] p-5 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]" />
            <div>
              <div className="text-sm font-semibold">Vos données hébergées en Europe</div>
              <p className="mt-0.5 text-sm text-[var(--muted)]">
                La base de données est hébergée en Europe.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]" />
            <div>
              <div className="text-sm font-semibold">Des cas fictifs, jamais de vrais patients</div>
              <p className="mt-0.5 text-sm text-[var(--muted)]">
                Tous les cas d&apos;entraînement sont fictifs — MELETA ne collecte aucune donnée
                de patient réel.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Ancre prix écoles ---- */}
      <section className="mt-6">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--border)] bg-white p-6 text-center sm:flex-row sm:text-left">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Building2 className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <h2 className="font-semibold">Écoles et organismes de formation</h2>
            <p className="mt-0.5 text-sm text-[var(--muted)]">
              Un accès dédié pour l&apos;ensemble de vos apprenants, avec un tarif au volume,
              sur devis. Marque blanche et suivi des cohortes inclus.
            </p>
          </div>
          <Link
            href="/demande-demo"
            data-analytics="tarif-ecoles"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]"
          >
            Demander un devis <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ---- Programme ambassadeur (connectés éligibles) ---- */}
      {showAffiliationBand && (
        <section className="mt-6">
          <AffiliationNudge rateTier1={rates.rateTier1} />
        </section>
      )}

      {/* ---- FAQ ---- */}
      <section className="mt-12 mb-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Questions fréquentes
        </h2>
        <div className="mt-4 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-white">
          {faq.map((item) => (
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
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faq.map((item) => ({
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
