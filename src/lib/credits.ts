// Portefeuille de crédits IA (B2C). Les drills QCM sont gratuits ; seules les
// mini-scènes (N2) et les entretiens simulés (N3) consomment des crédits.
import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { getConfig } from "./config";

export type SimKind = "miniscene" | "simulation";

// Valeurs par défaut (surchageables en admin via la table app_config).
export const CREDIT_DEFAULTS = {
  welcome: 10, // pack de bienvenue, à la création du compte
  monthly: 5, // recharge mensuelle gratuite (plancher, sans cumul)
  costMiniscene: 1,
  costSimulation: 2,
};

// Packs proposés à l'achat (prix indicatifs — le paiement réel arrive en Phase 2).
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
