// Portefeuille de crédits IA (B2C). Les drills QCM sont gratuits ; seules les
// mini-scènes (N2) et les entretiens simulés (N3) consomment des crédits.
import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { getConfig } from "./config";
import { isSubscriptionEntitled } from "./entitlements";
import { periodIndexFor } from "./billing-period";

export type SimKind = "miniscene" | "simulation";

// Valeurs par défaut (surchageables en admin via la table app_config).
export const CREDIT_DEFAULTS = {
  welcome: 10, // pack de bienvenue, à la création du compte
  monthly: 5, // recharge mensuelle gratuite (plancher, sans cumul)
  costMiniscene: 1,
  costSimulation: 2,
};

// Packs proposés à l'achat (paiement unique via Stripe Checkout — voir src/lib/billing.ts).
// Le Price ID Stripe de chaque pack se configure dans /admin/facturation.
export const CREDIT_PACKS = [
  { id: "s", credits: 20, priceEur: 19 },
  { id: "m", credits: 50, priceEur: 39 },
  { id: "l", credits: 100, priceEur: 69 },
];

export class InsufficientCreditsError extends Error {}

export type CreditSettings = {
  welcome: number;
  monthly: number;
  costMiniscene: number;
  costSimulation: number;
};

async function num(key: string, dflt: number): Promise<number> {
  const v = await getConfig(key);
  const n = v == null ? NaN : parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : dflt;
}

/** Réglages de crédits (admin), avec repli sur les valeurs par défaut. */
export async function creditSettings(): Promise<CreditSettings> {
  const [welcome, monthly, costMiniscene, costSimulation] = await Promise.all([
    num("credits.welcome", CREDIT_DEFAULTS.welcome),
    num("credits.monthly", CREDIT_DEFAULTS.monthly),
    num("credits.cost.miniscene", CREDIT_DEFAULTS.costMiniscene),
    num("credits.cost.simulation", CREDIT_DEFAULTS.costSimulation),
  ]);
  return { welcome, monthly, costMiniscene, costSimulation };
}

export function costFor(kind: SimKind, s: CreditSettings): number {
  return kind === "simulation" ? s.costSimulation : s.costMiniscene;
}

// Index de mois absolu (année*12 + mois) pour comparer deux dates au mois près.
function monthIndex(d: Date): number {
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

/**
 * Initialise (pack de bienvenue) puis recharge mensuellement le portefeuille,
 * de façon paresseuse : appelé à chaque accès, n'écrit qu'au besoin.
 * Retourne le solde courant.
 */
export async function syncWallet(userId: string): Promise<number> {
  const s = await creditSettings();
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const u = await tx.user.findUnique({ where: { id: userId } });
    if (!u) return 0;

    let delta = 0;
    let reason = "";
    if (u.creditsRefreshedAt == null) {
      delta = s.welcome;
      reason = "welcome";
    } else if (monthIndex(u.creditsRefreshedAt) < monthIndex(now)) {
      // Recharge = ramène au plancher mensuel sans jamais réduire un solde plus élevé.
      delta = Math.max(0, s.monthly - u.credits);
      reason = "monthly";
    } else {
      return u.credits; // déjà à jour ce mois-ci
    }

    const balanceAfter = u.credits + delta;
    await tx.user.update({
      where: { id: userId },
      data: { credits: balanceAfter, creditsRefreshedAt: now },
    });
    if (delta !== 0) {
      await tx.creditLedger.create({
        data: { userId, delta, balanceAfter, reason },
      });
    }
    return balanceAfter;
  });
}

/** Solde courant (sans rafraîchissement). */
export async function getCredits(userId: string): Promise<number> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true },
  });
  return u?.credits ?? 0;
}

/** Débite le portefeuille de façon atomique. Lève InsufficientCreditsError si solde insuffisant. */
export async function debit(
  userId: string,
  amount: number,
  reason: string,
  meta?: Record<string, unknown>,
): Promise<number> {
  if (amount <= 0) return getCredits(userId);
  return prisma.$transaction(async (tx) => {
    const u = await tx.user.findUnique({ where: { id: userId } });
    if (!u) throw new InsufficientCreditsError("compte introuvable");
    if (u.credits < amount) throw new InsufficientCreditsError("solde insuffisant");
    const balanceAfter = u.credits - amount;
    await tx.user.update({ where: { id: userId }, data: { credits: balanceAfter } });
    await tx.creditLedger.create({
      data: {
        userId,
        delta: -amount,
        balanceAfter,
        reason,
        meta: (meta ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    return balanceAfter;
  });
}

// --- Crédits d'abonnement : octroi idempotent par période -------------------

/** Nombre max de périodes rattrapées en une fois (garde-fou contre une ancre corrompue). */
const MAX_CATCHUP_PERIODS = 12;

/**
 * Crédite l'allocation d'UNE période d'abonnement, de façon STRUCTURELLEMENT
 * idempotente : la contrainte unique `(stripeSubscriptionId, reason, periodIndex)`
 * fait foi. Peu importe qui déclenche en premier — le webhook `invoice.paid` ou le
 * rechargement paresseux — ni combien de fois Stripe rejoue : le doublon est refusé
 * par la base, pas par une coordination entre deux chemins de code.
 *
 * Retourne `true` si l'octroi a eu lieu, `false` si la période était déjà créditée.
 */
export async function grantSubscriptionCredits(opts: {
  userId: string;
  amount: number;
  reason: "subscription_renewal" | "plan_upgrade_topup";
  stripeSubscriptionId: string;
  periodIndex: number;
  meta?: Record<string, unknown>;
}): Promise<boolean> {
  if (opts.amount <= 0) return false;
  try {
    await prisma.$transaction(async (tx) => {
      const u = await tx.user.findUnique({ where: { id: opts.userId } });
      if (!u) throw new Error("compte introuvable");
      const balanceAfter = u.credits + opts.amount;
      // create AVANT update : une violation d'unicité annule toute la transaction.
      await tx.creditLedger.create({
        data: {
          userId: opts.userId,
          delta: opts.amount,
          balanceAfter,
          reason: opts.reason,
          stripeSubscriptionId: opts.stripeSubscriptionId,
          periodIndex: opts.periodIndex,
          meta: (opts.meta ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
      await tx.user.update({
        where: { id: opts.userId },
        data: { credits: balanceAfter },
      });
    });
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return false; // période déjà créditée : no-op silencieux
    }
    throw e;
  }
}

/**
 * Recharge paresseuse des crédits de forfait, appelée à chaque accès (comme
 * `syncWallet`). Couvre l'essai (`trialing`) comme l'abonnement payant : une seule
 * règle, aucun cas particulier à la bascule trialing -> active.
 *
 * Cumulatif AVEC rattrapage, pour s'aligner sur le comportement du parcours payant
 * (piloté par les factures, donc indépendant de la connexion) : un utilisateur
 * absent deux mois retrouve les allocations manquées, comme un abonné facturé.
 *
 * Best-effort : ne lève jamais — un échec ici ne doit pas casser une page.
 */
export async function syncSubscriptionCredits(userId: string): Promise<void> {
  try {
    const sub = await prisma.userSubscription.findUnique({ where: { userId } });
    if (!sub || !isSubscriptionEntitled(sub.status)) return;

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: sub.planId } });
    if (!plan || plan.monthlyCredits <= 0) return;

    const anchor = sub.periodAnchorAt ?? sub.createdAt;
    const currentIndex = periodIndexFor(anchor, new Date());

    // Dernière période déjà créditée pour CET abonnement.
    const last = await prisma.creditLedger.findFirst({
      where: {
        stripeSubscriptionId: sub.stripeSubscriptionId,
        reason: "subscription_renewal",
      },
      orderBy: { periodIndex: "desc" },
      select: { periodIndex: true },
    });

    const from = last?.periodIndex == null ? 0 : last.periodIndex + 1;
    if (from > currentIndex) return; // à jour

    let start = from;
    if (currentIndex - start + 1 > MAX_CATCHUP_PERIODS) {
      start = currentIndex - MAX_CATCHUP_PERIODS + 1;
      console.warn(
        `[credits] rattrapage tronqué pour ${sub.stripeSubscriptionId} : ${from}..${currentIndex}`,
      );
    }

    for (let i = start; i <= currentIndex; i++) {
      await grantSubscriptionCredits({
        userId,
        amount: plan.monthlyCredits,
        reason: "subscription_renewal",
        stripeSubscriptionId: sub.stripeSubscriptionId,
        periodIndex: i,
        meta: { planId: plan.id, source: "lazy", status: sub.status },
      });
    }
  } catch (e) {
    console.error("[credits] échec du rechargement d'abonnement", userId, e);
  }
}

/** Crédite le portefeuille (octroi admin, remboursement, achat). */
export async function grant(
  userId: string,
  amount: number,
  reason: string,
  meta?: Record<string, unknown>,
): Promise<number> {
  if (amount <= 0) return getCredits(userId);
  return prisma.$transaction(async (tx) => {
    const u = await tx.user.findUnique({ where: { id: userId } });
    if (!u) throw new Error("compte introuvable");
    const balanceAfter = u.credits + amount;
    await tx.user.update({ where: { id: userId }, data: { credits: balanceAfter } });
    await tx.creditLedger.create({
      data: {
        userId,
        delta: amount,
        balanceAfter,
        reason,
        meta: (meta ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    return balanceAfter;
  });
}
