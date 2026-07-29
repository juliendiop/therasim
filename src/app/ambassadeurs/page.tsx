import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Calculator, FileText, Gift, Layers, Sparkles } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { resolveCommissionRate } from "@/lib/affiliation";
import { AMBASSADEURS_PAGE } from "@/lib/affiliation-copy";
import { planDeReference } from "@/lib/landing-copy";
import Track from "@/app/_components/track";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: AMBASSADEURS_PAGE.seo.title,
  description: AMBASSADEURS_PAGE.seo.description,
};

function renderCopy(
  text: string,
  vars: { t1: number; t2: number; seuil: string; cookie: number },
): string {
  return text
    .replaceAll("{T1}", String(vars.t1))
    .replaceAll("{T2}", String(vars.t2))
    .replaceAll("{SEUIL}", vars.seuil)
    .replaceAll("{COOKIE}", String(vars.cookie));
}

/** Formate un montant en euros sans décimales inutiles (12,50 € / 70 €). */
function euros(montant: number): string {
  return `${montant.toFixed(2).replace(".00", "").replace(".", ",")} €`;
}

export default async function AmbassadeursPage() {
  const [user, rates, plan] = await Promise.all([
    getSessionUser(),
    resolveCommissionRate(),
    planDeReference(),
  ]);
  const vars = {
    t1: rates.rateTier1,
    t2: rates.rateTier2,
    seuil: (rates.payoutMinCents / 100).toFixed(2).replace(".00", ""),
    cookie: rates.cookieDays,
  };
  const ctaHref = user ? "/affiliation" : "/inscription";

  // Exemple chiffré : forfait payant médian lu en base × taux lu en base. Aucun
  // prix codé en dur — si la grille tarifaire change, l'exemple suit.
  const NB_FILLEULS = 10;
  const exemple = plan
    ? (() => {
        const parFilleul = (plan.prixEuros * rates.rateTier1) / 100;
        const parMois = parFilleul * NB_FILLEULS;
        return {
          nbFilleuls: NB_FILLEULS,
          planLabel: plan.label,
          prixPlan: euros(plan.prixEuros),
          parFilleul: euros(parFilleul),
          parMois: euros(parMois),
          parAn: euros(parMois * 12),
        };
      })()
    : null;

  return (
    <div className="animate-in mx-auto max-w-4xl">
      <Track event="landing_view" path="/ambassadeurs" />

      {/* Hero */}
      <section className="mx-auto max-w-2xl pt-4 text-center sm:pt-8">
        <span className="text-xs font-semibold uppercase tracking-widest text-[var(--ochre)]">
          {AMBASSADEURS_PAGE.eyebrow}
        </span>
        <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          {AMBASSADEURS_PAGE.h1}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-[var(--ink-soft)]">
          {renderCopy(AMBASSADEURS_PAGE.lead, vars)}
        </p>
        <div className="mt-5">
          <Link
            href={ctaHref}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
          >
            {AMBASSADEURS_PAGE.ctaPrimary} <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-2 text-xs text-[var(--muted)]">{AMBASSADEURS_PAGE.ctaSecondaryNote}</p>
        </div>
      </section>

      {/* Chiffres clés */}
      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        {AMBASSADEURS_PAGE.highlights.map((h) => (
          <div
            key={h.label}
            className="rounded-2xl border border-[var(--border)] bg-white p-5 text-center"
          >
            <div className="text-2xl font-bold text-[var(--accent)]">{renderCopy(h.value, vars)}</div>
            <div className="mt-1 text-sm text-[var(--muted)]">{renderCopy(h.label, vars)}</div>
          </div>
        ))}
      </section>

      {/* Comment ça marche */}
      <section className="mt-12">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          <Sparkles className="h-3.5 w-3.5 text-[var(--ochre)]" /> {AMBASSADEURS_PAGE.howItWorksTitle}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {AMBASSADEURS_PAGE.howItWorks.map((step) => (
            <div key={step.n} className="rounded-2xl border border-[var(--border)] bg-white p-5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-soft)] text-sm font-bold text-[var(--accent)]">
                {step.n}
              </span>
              <h3 className="mt-3 font-semibold">{step.titre}</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">{renderCopy(step.texte, vars)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Exemple chiffré (calculé depuis les prix et taux en base) */}
      {exemple && (
        <section className="mt-12">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            <Calculator className="h-3.5 w-3.5 text-[var(--ochre)]" />{" "}
            {AMBASSADEURS_PAGE.exempleTitre}
          </h2>
          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-6">
            <p className="text-sm text-[var(--ink-soft)]">
              Prenons {exemple.nbFilleuls} filleuls abonnés au forfait{" "}
              <b>{exemple.planLabel}</b> à {exemple.prixPlan} par mois.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <div className="text-2xl font-bold text-[var(--accent)]">
                  {exemple.parFilleul}
                </div>
                <div className="mt-0.5 text-sm text-[var(--muted)]">
                  par filleul et par mois ({vars.t1} % de {exemple.prixPlan})
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[var(--accent)]">{exemple.parMois}</div>
                <div className="mt-0.5 text-sm text-[var(--muted)]">
                  par mois avec {exemple.nbFilleuls} filleuls abonnés
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[var(--accent)]">{exemple.parAn}</div>
                <div className="mt-0.5 text-sm text-[var(--muted)]">
                  sur douze mois, s&apos;ils restent tous abonnés
                </div>
              </div>
            </div>
            <p className="mt-4 text-xs text-[var(--muted)]">
              Illustration calculée sur le prix affiché du forfait {exemple.planLabel} et le taux
              en vigueur. Ce n&apos;est ni une prévision, ni une promesse de revenu : vos gains
              dépendent du nombre de personnes qui s&apos;abonnent via votre lien et du temps
              qu&apos;elles restent abonnées. La commission cesse si l&apos;abonnement prend fin.
            </p>
          </div>
        </section>
      )}

      {/* Deux niveaux */}
      <section className="mt-12">
        <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-tint)] p-6 sm:flex-row sm:items-center">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Layers className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold">{AMBASSADEURS_PAGE.twoLevelsTitle}</h2>
            <p className="mt-0.5 text-sm text-[var(--muted)]">
              {renderCopy(AMBASSADEURS_PAGE.twoLevelsText, vars)}
            </p>
          </div>
        </div>
      </section>

      {/* Écoles */}
      <section className="mt-6" id="ecoles">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--border)] bg-white p-6 text-center sm:flex-row sm:text-left">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Gift className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <h2 className="font-semibold">{AMBASSADEURS_PAGE.schoolsTitle}</h2>
            <p className="mt-0.5 text-sm text-[var(--muted)]">{AMBASSADEURS_PAGE.schoolsText}</p>
          </div>
          <Link
            href={ctaHref}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]"
          >
            {AMBASSADEURS_PAGE.schoolsCta}
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-12 mb-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          {AMBASSADEURS_PAGE.faqTitle}
        </h2>
        <div className="mt-4 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-white">
          {AMBASSADEURS_PAGE.faq.map((item) => (
            <div key={item.q} className="p-4">
              <h3 className="text-sm font-semibold">{item.q}</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">{renderCopy(item.a, vars)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Prérequis de facturation — AVANT le CTA qui mène au formulaire d'activation */}
      <section className="mt-12">
        <div className="flex flex-col gap-3 rounded-2xl border border-[var(--ochre)] bg-[var(--ochre-soft)] p-6 sm:flex-row">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/70 text-[var(--ochre)]">
            <FileText className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold">{AMBASSADEURS_PAGE.prerequisTitre}</h2>
            <p className="mt-0.5 text-sm text-[var(--ink-soft)]">
              {AMBASSADEURS_PAGE.prerequisTexte}
            </p>
            <Link
              href="/conditions-ambassadeurs"
              className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)] hover:underline"
            >
              Conditions du programme <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="mb-10 mt-6">
        <div className="rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-6 text-center">
          <h2 className="font-semibold">{AMBASSADEURS_PAGE.finalCtaTitle}</h2>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">{AMBASSADEURS_PAGE.finalCtaText}</p>
          <Link
            href={ctaHref}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
          >
            {AMBASSADEURS_PAGE.finalCta} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Données structurées SEO : schema.org FAQPage. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: AMBASSADEURS_PAGE.faq.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: { "@type": "Answer", text: renderCopy(item.a, vars) },
            })),
          }),
        }}
      />
    </div>
  );
}
