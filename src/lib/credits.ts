// Portefeuille de crédits IA (B2C). Les drills QCM sont gratuits ; seules les
// mini-scènes (N2) et les séances simulées (N3) consomment des crédits.
import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { getConfig } from "./config";
import { isSubscriptionEntitled } from "./entitlements";
import { periodIndexFor } from "./billing-period";
import { splitDebit } from "./credit-split";

export type SimKind = "miniscene" | "simulation";

// Valeurs par défaut (surchageables en admin via la table app_config).
export const CREDIT_DEFAULTS = {
  welcome: 10, // pack de bienvenue, à la création du compte
  monthly: 5, // recharge mensuelle gratuite (plancher, sans cumul)
  costMiniscene: 1,
  costSimulation: 2,
};

// Packs de crédits (recharge ponctuelle, réservée aux abonnés). Source de vérité UNIQUE
// désormais en base (modèle CreditPack) : plus de constante en dur ni de lecture des
// clés app_config `stripe.price.pack.*`.
export type CreditPackView = {
  id: string;
  credits: number;
  priceEurCents: number;
  stripePriceId: string | null;
};

/** Packs actifs, du plus petit au plus grand. */
export async function getCreditPacks(): Promise<CreditPackView[]> {
  const rows = await prisma.creditPack.findMany({
    where: { active: true },
    orderBy: { ordre: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    credits: r.credits,
    priceEurCents: r.priceEurCents,
    stripePriceId: r.stripePriceId,
  }));
}

/** Un pack par id (actif ou non). Null si inconnu. */
export async function getCreditPack(id: string): Promise<CreditPackView | null> {
  const r = await prisma.creditPack.findUnique({ where: { id } });
  return r
    ? { id: r.id, credits: r.credits, priceEurCents: r.priceEurCents, stripePriceId: r.stripePriceId }
    : null;
}

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

/**
 * Seuil (en crédits) du bandeau bas-solde. Sans rapport avec le pack de bienvenue :
 * défaut = 2 × le coût d'une séance complète (« de quoi mener 2 séances »). Éditable
 * via `limits.lowBalanceThreshold` en admin.
 */
export async function lowBalanceThreshold(s: CreditSettings): Promise<number> {
  const v = await getConfig("limits.lowBalanceThreshold");
  const n = v == null ? NaN : parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 2 * s.costSimulation;
}

// Index de mois absolu (année*12 + mois) pour comparer deux dates au mois près.
function monthIndex(d: Date): number {
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

/**
 * Vue détaillée du solde : portefeuille persistant (packs + gratuits), allocation
 * de forfait de la période en cours, et total. `total` est ce qu'on affiche.
 */
export type WalletView = { wallet: number; plan: number; total: number };

/** Lit le solde détaillé, sans rafraîchissement. */
export async function getWalletView(userId: string): Promise<WalletView> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true, planCredits: true },
  });
  const wallet = u?.credits ?? 0;
  const plan = u?.planCredits ?? 0;
  return { wallet, plan, total: wallet + plan };
}

/**
 * Initialise (pack de bienvenue) puis recharge mensuellement le PORTEFEUILLE
 * gratuit, de façon paresseuse : appelé à chaque accès, n'écrit qu'au besoin.
 * N'agit que sur `credits` (portefeuille) ; l'allocation de forfait vit dans
 * `planCredits` (voir syncSubscriptionCredits). Retourne le TOTAL courant.
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
      return u.credits + u.planCredits; // déjà à jour ce mois-ci
    }

    const newWallet = u.credits + delta;
    const balanceAfter = newWallet + u.planCredits; // ledger = TOTAL après mouvement
    await tx.user.update({
      where: { id: userId },
      data: { credits: newWallet, creditsRefreshedAt: now },
    });
    if (delta !== 0) {
      await tx.creditLedger.create({
        data: { userId, delta, balanceAfter, reason },
      });
    }
    return balanceAfter;
  });
}

/** Solde TOTAL courant (portefeuille + forfait), sans rafraîchissement. */
export async function getCredits(userId: string): Promise<number> {
  const { total } = await getWalletView(userId);
  return total;
}

/**
 * Vrai si l'utilisateur bénéficie d'un forfait « sans compter » (abonnement entitled
 * dont le plan a `monthlyCredits == null`). Les mises en situation ne sont alors pas
 * décomptées — le garde-fou anti-abus (usage-limits) reste seul en vigueur.
 */
export async function isUnlimited(userId: string): Promise<boolean> {
  const sub = await prisma.userSubscription.findUnique({ where: { userId } });
  if (!sub || !isSubscriptionEntitled(sub.status)) return false;
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: sub.planId } });
  return Boolean(plan && plan.monthlyCredits == null);
}

/**
 * Débite le solde de façon atomique.
 *
 * ORDRE DE CONSOMMATION (contrat, couvert par un test) : on puise D'ABORD dans
 * l'allocation d'abonnement (`planCredits`, périssable — autant l'utiliser avant qu'elle
 * n'expire en fin de période), PUIS dans le portefeuille persistant (`credits` : packs
 * achetés + crédits gratuits, sans péremption). Lève InsufficientCreditsError si le total
 * est insuffisant. Un forfait « sans compter » ne débite jamais rien.
 */
export async function debit(
  userId: string,
  amount: number,
  reason: string,
  meta?: Record<string, unknown>,
): Promise<number> {
  if (amount <= 0) return getCredits(userId);
  // Forfait « sans compter » : aucun décompte, aucun blocage sur le solde.
  if (await isUnlimited(userId)) return getCredits(userId);
  return prisma.$transaction(async (tx) => {
    const u = await tx.user.findUnique({ where: { id: userId } });
    if (!u) throw new InsufficientCreditsError("compte introuvable");
    const total = u.credits + u.planCredits;
    if (total < amount) throw new InsufficientCreditsError("solde insuffisant");

    // Ordre de consommation (allocation d'abord, portefeuille ensuite) — logique PURE,
    // couverte par test/consumption-order.test.ts.
    const { fromPlan, fromWallet } = splitDebit(u.planCredits, u.credits, amount);
    const balanceAfter = total - amount;
    await tx.user.update({
      where: { id: userId },
      data: { planCredits: u.planCredits - fromPlan, credits: u.credits - fromWallet },
    });
    await tx.creditLedger.create({
      data: {
        userId,
        delta: -amount,
        balanceAfter,
        reason,
        meta: { ...(meta ?? {}), fromPlan, fromWallet } as Prisma.InputJsonValue,
      },
    });
    return balanceAfter;
  });
}

// --- Crédits de forfait : allocation NON cumulative par période -------------
//
// Modèle « use-it-or-lose-it » : `planCredits` porte l'allocation de la période
// EN COURS. À chaque nouvelle période, on la REMET à la valeur du forfait (le
// reliquat non consommé est perdu — jamais additionné). À la fin de l'accès, elle
// tombe à 0. Le portefeuille `credits` (packs achetés + gratuits) n'est jamais touché.

/**
 * (Ré)initialise l'allocation de forfait pour UNE période, de façon
 * STRUCTURELLEMENT idempotente : la contrainte unique
 * `(stripeSubscriptionId, "subscription_renewal", periodIndex)` garantit un seul
 * reset par période. Un rejeu Stripe, ou un second rechargement paresseux dans la
 * même période, deviennent des no-op — donc on ne « recharge » jamais des crédits
 * déjà consommés au sein d'une période.
 *
 * SET (planCredits := allocation), pas ADD : c'est ce qui rend le modèle non
 * cumulatif. Retourne `true` si le reset a eu lieu, `false` si la période l'était déjà.
 */
async function grantPlanPeriod(opts: {
  userId: string;
  allocation: number;
  stripeSubscriptionId: string;
  periodIndex: number;
  planId: string;
  status: string;
  source: string;
}): Promise<boolean> {
  try {
    await prisma.$transaction(async (tx) => {
      const u = await tx.user.findUnique({ where: { id: opts.userId } });
      if (!u) throw new Error("compte introuvable");
      const forfeited = u.planCredits; // reliquat de la période précédente, perdu
      const balanceAfter = u.credits + opts.allocation; // total après reset
      // create AVANT update : une violation d'unicité annule toute la transaction.
      await tx.creditLedger.create({
        data: {
          userId: opts.userId,
          delta: opts.allocation - forfeited, // variation du total (allocation remplace le reliquat)
          balanceAfter,
          reason: "subscription_renewal",
          stripeSubscriptionId: opts.stripeSubscriptionId,
          periodIndex: opts.periodIndex,
          meta: {
            allocation: opts.allocation,
            forfeited,
            planId: opts.planId,
            source: opts.source,
            status: opts.status,
          } as Prisma.InputJsonValue,
        },
      });
      await tx.user.update({
        where: { id: opts.userId },
        data: { planCredits: opts.allocation },
      });
    });
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return false; // période déjà servie : no-op silencieux
    }
    throw e;
  }
}

/**
 * Remet l'allocation de forfait à 0 (fin d'accès : essai terminé, abonnement
 * résilié/expiré). N'agit que si `planCredits > 0`, donc idempotent et sans écriture
 * superflue à chaque accès. Le portefeuille `credits` reste intact.
 */
export async function zeroPlanCredits(
  userId: string,
  reason: "plan_expired" = "plan_expired",
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const u = await tx.user.findUnique({ where: { id: userId } });
    if (!u || u.planCredits === 0) return;
    await tx.user.update({ where: { id: userId }, data: { planCredits: 0 } });
    await tx.creditLedger.create({
      data: { userId, delta: -u.planCredits, balanceAfter: u.credits, reason },
    });
  });
}

/**
 * Complément d'allocation lors d'un changement de forfait EN COURS de période
 * (ex. Essentiel -> Intensif) : ajoute le différentiel à `planCredits` pour que
 * l'abonné dispose immédiatement du plafond supérieur, sans attendre le cycle
 * suivant. Idempotent par (sub, "plan_upgrade_topup", periodIndex).
 */
export async function topUpPlanCredits(opts: {
  userId: string;
  amount: number;
  stripeSubscriptionId: string;
  periodIndex: number;
  meta?: Record<string, unknown>;
}): Promise<void> {
  if (opts.amount <= 0) return;
  try {
    await prisma.$transaction(async (tx) => {
      const u = await tx.user.findUnique({ where: { id: opts.userId } });
      if (!u) throw new Error("compte introuvable");
      const newPlan = u.planCredits + opts.amount;
      const balanceAfter = u.credits + newPlan;
      await tx.creditLedger.create({
        data: {
          userId: opts.userId,
          delta: opts.amount,
          balanceAfter,
          reason: "plan_upgrade_topup",
          stripeSubscriptionId: opts.stripeSubscriptionId,
          periodIndex: opts.periodIndex,
          meta: (opts.meta ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
      await tx.user.update({
        where: { id: opts.userId },
        data: { planCredits: newPlan },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return;
    throw e;
  }
}

/**
 * Synchronise l'allocation de forfait, appelée à chaque accès (comme `syncWallet`)
 * ET par les webhooks Stripe. Une seule règle couvre l'essai (`trialing`) comme
 * l'abonnement payant, et la fin d'accès :
 *   - non entitled (ou forfait sans crédits) -> planCredits remis à 0 ;
 *   - sinon -> planCredits (ré)initialisé à l'allocation de la période courante,
 *     une seule fois par période (non cumulatif).
 *
 * `at` permet aux webhooks de viser la période FACTURÉE plutôt que « maintenant ».
 * Best-effort : ne lève jamais — un échec ici ne doit pas casser une page.
 */
export async function syncSubscriptionCredits(
  userId: string,
  at: Date = new Date(),
): Promise<void> {
  try {
    const sub = await prisma.userSubscription.findUnique({ where: { userId } });
    if (!sub || !isSubscriptionEntitled(sub.status)) {
      await zeroPlanCredits(userId);
      return;
    }

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: sub.planId } });
    // `monthlyCredits` null = « sans compter » (aucune allocation numérique ; le débit
    // est court-circuité pour ces forfaits, voir `debit`/`isUnlimited`). Comme pour 0,
    // on remet simplement `planCredits` à 0.
    if (!plan || plan.monthlyCredits == null || plan.monthlyCredits <= 0) {
      await zeroPlanCredits(userId);
      return;
    }

    const anchor = sub.periodAnchorAt ?? sub.createdAt;

    // GARDE « une seule allocation par essai ».
    // `periodIndexFor` compte en MOIS CALENDAIRES ; un essai exprimé en JOURS peut donc
    // franchir une frontière de période AVANT la fin de l'essai : ancre+1 mois vaut J+28/29
    // (février) ou J+30 (avril/juin/septembre/novembre — la bêta de septembre est ce cas
    // nominal), soit avant ou pile à la fin d'un essai de 30 jours. Sans garde, un
    // `syncSubscriptionCredits` déclenché par un accès ou un webhook pendant que le statut
    // est encore `trialing` verrait `periodIndex` = 1 et poserait une SECONDE allocation.
    // On déduit donc le nombre d'allocations de l'ESSAI, jamais du calendrier : pendant
    // `trialing`, l'allocation est celle de la période 0, un point c'est tout.
    //
    // On ne touche PAS `periodIndexFor` ni l'ancrage : le parcours PAYANT reste calendaire
    // (et `periodIndex` lui sert aussi de clé de déduplication). ⚠️ Cette garde vaut tant
    // qu'un essai est PLUS COURT qu'une période de facturation (1 mois). À revoir si un
    // essai long (> 1 mois, donc couvrant plusieurs périodes) réapparaît.
    const currentIndex = sub.status === "trialing" ? 0 : periodIndexFor(anchor, at);

    await grantPlanPeriod({
      userId,
      allocation: plan.monthlyCredits,
      stripeSubscriptionId: sub.stripeSubscriptionId,
      periodIndex: currentIndex,
      planId: plan.id,
      status: sub.status,
      source: "sync",
    });
  } catch (e) {
    console.error("[credits] échec de la synchro d'abonnement", userId, e);
  }
}

/** Crédite le PORTEFEUILLE persistant (octroi admin, remboursement, achat de pack). */
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
    const newWallet = u.credits + amount;
    const balanceAfter = newWallet + u.planCredits; // ledger = TOTAL après mouvement
    await tx.user.update({ where: { id: userId }, data: { credits: newWallet } });
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
