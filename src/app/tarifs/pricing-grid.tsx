"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Star } from "lucide-react";
import { checkoutPlanAction } from "@/app/credits/actions";
import SubmitButton from "@/app/_components/submit-button";

export type PricingPlan = {
  id: string;
  key: string;
  label: string;
  priceEurCents: number;
  monthlyCredits: number | null; // null = « sans compter »
  frameworkQuota: number | null; // null = toutes les spécialités
  stripePriceId: string | null;
  stripePriceIdYearly: string | null;
};

type Props = {
  plans: PricingPlan[];
  costMiniscene: number;
  costSimulation: number;
  isLoggedIn: boolean;
  canSubscribe: boolean; // freemium : peut souscrire (site public / B2B opt-in)
  stripeReady: boolean;
};

type Cycle = "monthly" | "yearly";

const eur = (cents: number) => (cents / 100).toFixed(2).replace(".00", "");

/** Ligne « spécialités » : le socle est affiché séparément, ici on ne compte que les spécialités. */
function specialtiesLabel(quota: number | null): string {
  if (quota == null) return "Toutes les spécialités actuelles";
  return `${quota} spécialité${quota > 1 ? "s" : ""} au choix`;
}

/** Traduction des crédits en usage concret (ratios calculés depuis les coûts réels). */
function usageLine(plan: PricingPlan, costMini: number, costSim: number): string {
  if (plan.monthlyCredits == null) return "Simulations sans compter";
  const credits = plan.monthlyCredits;
  const mini = Math.floor(credits / Math.max(1, costMini));
  // Sur le gratuit, le N3 est limité à 1 à vie : les crédits mensuels servent aux
  // mini-scènes — on n'affiche donc pas de « X séances » trompeur.
  if (plan.priceEurCents === 0) {
    return `≈ ${mini} mini-scène${mini > 1 ? "s" : ""} par mois`;
  }
  const seances = Math.floor(credits / Math.max(1, costSim));
  return `≈ ${seances} séance${seances > 1 ? "s" : ""} complète${seances > 1 ? "s" : ""} ou ${mini} mini-scène${mini > 1 ? "s" : ""} par mois`;
}

export default function PricingGrid({
  plans,
  costMiniscene,
  costSimulation,
  isLoggedIn,
  canSubscribe,
  stripeReady,
}: Props) {
  const [cycle, setCycle] = useState<Cycle>("monthly");

  return (
    <div>
      {/* Bascule mensuel / annuel (sans rechargement) */}
      <div className="flex justify-center">
        <div className="inline-flex items-center rounded-xl border border-[var(--border)] bg-white p-1 text-sm">
          <button
            type="button"
            onClick={() => setCycle("monthly")}
            className={`rounded-lg px-4 py-1.5 font-medium transition ${
              cycle === "monthly"
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            Mensuel
          </button>
          <button
            type="button"
            onClick={() => setCycle("yearly")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 font-medium transition ${
              cycle === "yearly"
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            Annuel
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                cycle === "yearly" ? "bg-white/20 text-white" : "bg-[var(--ochre-soft)] text-[var(--ochre)]"
              }`}
            >
              2 mois offerts
            </span>
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((p) => (
          <PlanCard
            key={p.id}
            plan={p}
            cycle={cycle}
            costMiniscene={costMiniscene}
            costSimulation={costSimulation}
            isLoggedIn={isLoggedIn}
            canSubscribe={canSubscribe}
            stripeReady={stripeReady}
          />
        ))}
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  cycle,
  costMiniscene,
  costSimulation,
  isLoggedIn,
  canSubscribe,
  stripeReady,
}: {
  plan: PricingPlan;
  cycle: Cycle;
} & Omit<Props, "plans">) {
  const isFree = plan.priceEurCents === 0;
  const highlighted = plan.key === "praticien";
  const yearlyCents = plan.priceEurCents * 10; // 2 mois offerts
  const priceAvailable =
    isFree || (cycle === "monthly" ? Boolean(plan.stripePriceId) : Boolean(plan.stripePriceIdYearly));
  const analytics = `tarif-${plan.key}-${isFree ? "free" : cycle}`;

  return (
    <div
      className={`relative flex flex-col rounded-2xl border bg-white p-5 ${
        highlighted ? "border-[var(--accent)] shadow-md lg:scale-[1.03]" : "border-[var(--border)]"
      }`}
    >
      {highlighted && (
        <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-[var(--accent)] px-3 py-1 text-[11px] font-semibold text-white shadow-sm">
          <Star className="h-3 w-3" /> Le plus choisi
        </span>
      )}

      <div className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        {plan.label}
      </div>

      {/* Prix */}
      <div className="mt-1.5 text-3xl font-bold">
        {isFree ? (
          "Gratuit"
        ) : cycle === "monthly" ? (
          <>
            {eur(plan.priceEurCents)} €
            <span className="text-sm font-normal text-[var(--muted)]">/mois</span>
          </>
        ) : (
          <>
            {eur(yearlyCents)} €<span className="text-sm font-normal text-[var(--muted)]">/an</span>
          </>
        )}
      </div>
      {!isFree && cycle === "yearly" && (
        <div className="mt-0.5 text-xs text-[var(--muted)]">
          soit {eur(plan.priceEurCents)} €/mois · 2 mois offerts
        </div>
      )}

      {/* Bénéfices — ordre imposé */}
      <ul className="mt-3 flex-1 space-y-1.5 text-sm text-[var(--ink-soft)]">
        <li className="flex items-start gap-1.5">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
          <span>
            <Link href="/domaines" className="font-medium text-[var(--accent)] hover:underline">
              Socle clinique inclus
            </Link>
          </span>
        </li>
        <li className="flex items-start gap-1.5">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
          {specialtiesLabel(plan.frameworkQuota)}
        </li>
        <li className="flex items-start gap-1.5">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
          Exercices illimités
        </li>
        <li className="flex items-start gap-1.5">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
          {usageLine(plan, costMiniscene, costSimulation)}
        </li>
        {isFree && (
          <li className="flex items-start gap-1.5">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
            1 séance complète offerte, à vie
          </li>
        )}
      </ul>

      {plan.monthlyCredits != null && (
        <p className="mt-2 text-[11px] text-[var(--muted)]">Crédits non reportés d&apos;un mois sur l&apos;autre.</p>
      )}

      {/* CTA */}
      <div className="mt-4">
        {isFree ? (
          <Link
            href={isLoggedIn ? "/accueil" : "/inscription"}
            data-analytics={analytics}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]"
          >
            {isLoggedIn ? "Accéder à mon espace" : "Commencer gratuitement"}{" "}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : !isLoggedIn ? (
          priceAvailable ? (
            <Link
              href={`/inscription?plan=${plan.id}&cycle=${cycle}`}
              data-analytics={analytics}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
            >
              S&apos;abonner <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <UnavailableCta cycle={cycle} />
          )
        ) : canSubscribe ? (
          <form action={checkoutPlanAction}>
            <input type="hidden" name="planId" value={plan.id} />
            <input type="hidden" name="cycle" value={cycle} />
            <input type="hidden" name="cta" value={analytics} />
            <SubmitButton
              disabled={!stripeReady || !priceAvailable}
              pendingText="Redirection…"
              className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
            >
              S&apos;abonner
            </SubmitButton>
            {!priceAvailable && cycle === "yearly" && (
              <p className="mt-1.5 text-center text-[11px] text-[var(--muted)]">
                Formule annuelle bientôt disponible.
              </p>
            )}
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
}

function UnavailableCta({ cycle }: { cycle: Cycle }) {
  return (
    <div>
      <button
        disabled
        className="w-full rounded-lg bg-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-500"
      >
        S&apos;abonner
      </button>
      {cycle === "yearly" && (
        <p className="mt-1.5 text-center text-[11px] text-[var(--muted)]">
          Formule annuelle bientôt disponible.
        </p>
      )}
    </div>
  );
}
