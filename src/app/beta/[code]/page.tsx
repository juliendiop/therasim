import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowRight, CreditCard, Gift, Lock, Sparkles, Timer } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findBetaInvite, BETA_PLAN_KEY, BETA_TRIAL_DAYS } from "@/lib/beta";
import { isSubscriptionEntitled } from "@/lib/entitlements";
import ClaimButton from "./claim-button";

export const dynamic = "force-dynamic";

// Page d'activation privée : jamais indexée, jamais listée.
export const metadata: Metadata = {
  title: "Accès bêta — MELETA",
  robots: { index: false, follow: false },
};

export default async function BetaClaimPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const user = await getSessionUser();
  const invite = await findBetaInvite(code);

  // --- Cas déjà réclamé PAR l'utilisateur courant : rien à faire, on l'envoie chez lui.
  if (invite && invite.status === "CLAIMED" && user && invite.claimedByUserId === user.id) {
    redirect("/accueil?beta=1");
  }

  // --- Tous les autres cas d'invalidité renvoient le MÊME écran.
  // Ne jamais distinguer « code inconnu » de « code révoqué » ou « déjà utilisé » :
  // la différence permettrait d'énumérer les codes valides.
  const unusable =
    !invite ||
    invite.isExpired ||
    invite.status === "REVOKED" ||
    invite.status === "EXPIRED" ||
    invite.status === "CLAIMED";

  if (unusable) return <InviteUnusable />;

  const plan = await prisma.subscriptionPlan.findUnique({ where: { key: BETA_PLAN_KEY } });

  // --- Visiteur non connecté : présentation + CTA qui conservent le code.
  if (!user) {
    const back = `/beta/${encodeURIComponent(invite.code)}`;
    return <InviteIntro planLabel={plan?.label ?? "Intensif"} back={back} />;
  }

  // --- Connecté mais déjà servi : on le dit franchement plutôt que de le laisser
  // cliquer sur un bouton qui échouera.
  const [dbUser, sub] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id } }),
    prisma.userSubscription.findUnique({ where: { userId: user.id } }),
  ]);
  if (dbUser?.isBetaTester) return <AlreadyServed reason="beta" />;
  if (sub && isSubscriptionEntitled(sub.status)) return <AlreadyServed reason="subscription" />;

  return (
    <InviteConfirm
      code={invite.code}
      planLabel={plan?.label ?? "Intensif"}
      monthlyCredits={plan?.monthlyCredits ?? null}
    />
  );
}

// --- Écrans ----------------------------------------------------------------

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="animate-in mx-auto max-w-xl py-4 sm:py-8">{children}</div>;
}

function InviteUnusable() {
  return (
    <Shell>
      <div className="card-soft p-8 text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--surface-tint)] text-[var(--muted)]">
          <Lock className="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-xl font-semibold">Ce lien d&apos;invitation n&apos;est pas utilisable</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Il a peut-être déjà servi, ou sa validité est dépassée. Si vous pensez qu&apos;il s&apos;agit
          d&apos;une erreur, répondez simplement à l&apos;email qui vous l&apos;a transmis.
        </p>
        <Link
          href="/tarifs"
          className="mt-6 inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]"
        >
          Voir les formules <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </Shell>
  );
}

function AlreadyServed({ reason }: { reason: "beta" | "subscription" }) {
  return (
    <Shell>
      <div className="card-soft p-8 text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <Sparkles className="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-xl font-semibold">
          {reason === "beta" ? "Votre accès bêta est déjà actif" : "Vous avez déjà un abonnement"}
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {reason === "beta"
            ? "Inutile d'activer une seconde invitation."
            : "Écrivez-nous si vous souhaitez basculer sur l'accès bêta — on s'en occupe à la main."}
        </p>
        <Link
          href="/accueil"
          className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
        >
          Aller à mon espace <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </Shell>
  );
}

function KeyFacts({ planLabel }: { planLabel: string }) {
  const facts = [
    { icon: <Gift className="h-4 w-4" />, text: `Le forfait ${planLabel} vous est offert.` },
    {
      icon: <Timer className="h-4 w-4" />,
      text: `Pendant ${BETA_TRIAL_DAYS} jours, avec les crédits mensuels du forfait.`,
    },
    {
      icon: <CreditCard className="h-4 w-4" />,
      text: "Aucune carte bancaire n'est demandée, ni maintenant ni à la fin.",
    },
  ];
  return (
    <ul className="mt-5 space-y-2.5">
      {facts.map((f) => (
        <li key={f.text} className="flex items-start gap-2.5 text-sm">
          <span className="mt-0.5 shrink-0 text-[var(--accent)]">{f.icon}</span>
          <span>{f.text}</span>
        </li>
      ))}
    </ul>
  );
}

function InviteIntro({ planLabel, back }: { planLabel: string; back: string }) {
  return (
    <Shell>
      <span className="text-xs font-semibold uppercase tracking-widest text-[var(--ochre)]">
        Invitation bêta
      </span>
      <h1 className="mt-3 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
        Le forfait {planLabel} vous est offert pendant {BETA_TRIAL_DAYS} jours
      </h1>
      <p className="mt-3 text-base text-[var(--ink-soft)]">
        Vous faites partie d&apos;un petit groupe de praticiens invités à éprouver MELETA en
        conditions réelles. Aucune carte bancaire ne vous sera demandée.
      </p>

      <div className="card-soft mt-6 p-6">
        <KeyFacts planLabel={planLabel} />
        <p className="mt-5 text-sm text-[var(--muted)]">
          Créez votre compte (ou connectez-vous) pour activer l&apos;accès. Votre invitation est
          conservée pendant l&apos;opération.
        </p>
        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
          <Link
            href={`/inscription?next=${encodeURIComponent(back)}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
          >
            Créer mon compte <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href={`/login?next=${encodeURIComponent(back)}`}
            className="inline-flex items-center justify-center rounded-lg border border-[var(--border)] px-5 py-2.5 text-sm font-medium hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            J&apos;ai déjà un compte
          </Link>
        </div>
      </div>
    </Shell>
  );
}

function InviteConfirm({
  code,
  planLabel,
  monthlyCredits,
}: {
  code: string;
  planLabel: string;
  monthlyCredits: number | null;
}) {
  return (
    <Shell>
      <span className="text-xs font-semibold uppercase tracking-widest text-[var(--ochre)]">
        Invitation bêta
      </span>
      <h1 className="mt-3 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
        Votre accès est prêt à être activé
      </h1>

      <div className="card-soft mt-6 p-6">
        <KeyFacts planLabel={planLabel} />
        {monthlyCredits !== null && (
          <p className="mt-3 text-sm text-[var(--muted)]">
            Soit <b>{monthlyCredits} crédits</b> par mois, rechargés chaque mois de l&apos;essai.
          </p>
        )}

        {/* Engagement explicite exigé : durée, absence de carte, absence de prélèvement. */}
        <p className="mt-5 rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)] p-4 text-sm">
          Forfait <b>{planLabel}</b> offert pendant <b>{BETA_TRIAL_DAYS} jours</b>. Aucune carte
          bancaire demandée. À la fin de la période, l&apos;accès s&apos;arrête et{" "}
          <b>rien ne vous est prélevé</b>.
        </p>

        <div className="mt-5">
          <ClaimButton code={code} />
        </div>
      </div>
    </Shell>
  );
}
