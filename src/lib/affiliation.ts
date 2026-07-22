// Programme d'affiliation « Ambassadeurs MELETA ». Logique métier : résolution
// du parrain, calcul des commissions (déclenché par Stripe), lecture des
// statistiques d'un ambassadeur. Voir Conception/spec-affiliation-ambassadeurs.md.
//
// ⚠️ Limite légale STRICTE : 2 niveaux MAXIMUM (parrain direct + parrain du
// parrain). Le niveau 2 est dérivé (jamais stocké) à partir de
// `User.referredByUserId` du parrain direct — ne JAMAIS chaîner plus loin,
// sous peine de dispositif assimilable à un système pyramidal (interdit,
// art. L.122-6 du Code de la consommation).
import "server-only";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { getConfig, setConfig } from "./config";

const REFERRAL_COOKIE = "ts_ref";

// --- Configuration (AppConfig, valeurs par défaut) --------------------------

export const AFFILIATION_DEFAULTS = {
  enabled: true,
  rateTier1: 20, // %
  rateTier2: 5, // %
  payoutMinCents: 5000, // 50 €
  cookieDays: 90,
};

async function configBool(key: string, dflt: boolean): Promise<boolean> {
  const v = await getConfig(key);
  if (v == null) return dflt;
  return v === "true";
}

async function configNum(key: string, dflt: number): Promise<number> {
  const v = await getConfig(key);
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) ? n : dflt;
}

export type CommissionRates = {
  enabled: boolean;
  rateTier1: number;
  rateTier2: number;
  payoutMinCents: number;
  cookieDays: number;
};

/** Lit les réglages du programme depuis AppConfig, avec repli sur les défauts. */
export async function resolveCommissionRate(): Promise<CommissionRates> {
  const [enabled, rateTier1, rateTier2, payoutMinCents, cookieDays] = await Promise.all([
    configBool("affiliation.enabled", AFFILIATION_DEFAULTS.enabled),
    configNum("affiliation.rate.tier1", AFFILIATION_DEFAULTS.rateTier1),
    configNum("affiliation.rate.tier2", AFFILIATION_DEFAULTS.rateTier2),
    configNum("affiliation.payout.min", AFFILIATION_DEFAULTS.payoutMinCents),
    configNum("affiliation.cookie.days", AFFILIATION_DEFAULTS.cookieDays),
  ]);
  return { enabled, rateTier1, rateTier2, payoutMinCents, cookieDays };
}

/** Enregistre les réglages du programme (admin). */
export async function saveCommissionRates(input: {
  enabled: boolean;
  rateTier1: number;
  rateTier2: number;
  payoutMinCents: number;
  cookieDays: number;
}): Promise<void> {
  await Promise.all([
    setConfig("affiliation.enabled", String(input.enabled)),
    setConfig("affiliation.rate.tier1", String(input.rateTier1)),
    setConfig("affiliation.rate.tier2", String(input.rateTier2)),
    setConfig("affiliation.payout.min", String(input.payoutMinCents)),
    setConfig("affiliation.cookie.days", String(input.cookieDays)),
  ]);
}

// --- Cookie d'attribution (first-touch) -------------------------------------

/**
 * Pose le cookie d'attribution `ts_ref` = code, SAUF s'il existe déjà (le
 * premier parrain gagne — first-touch, plus équitable et standard).
 */
export async function setReferralCookie(code: string): Promise<void> {
  const jar = await cookies();
  if (jar.get(REFERRAL_COOKIE)?.value) return; // ne jamais écraser
  const { cookieDays } = await resolveCommissionRate();
  jar.set(REFERRAL_COOKIE, code, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * cookieDays,
  });
}

/** Lit le code de parrainage capturé (cookie ts_ref), sans le poser. */
export async function peekReferralCode(): Promise<string | null> {
  return (await cookies()).get(REFERRAL_COOKIE)?.value ?? null;
}

/**
 * Résout le cookie `ts_ref` en `referredByUserId` pour un compte NOUVEAU (appelé
 * juste après sa création, dans /api/auth/register et /api/auth/callback).
 * Idempotent (ne réécrit jamais un referredByUserId déjà posé) et gardé contre
 * l'auto-parrainage et les cycles de niveau 2. Best-effort : n'échoue jamais.
 */
export async function attributeReferralForNewUser(newUserId: string): Promise<void> {
  try {
    const code = await peekReferralCode();
    if (!code) return;

    const current = await prisma.user.findUnique({ where: { id: newUserId } });
    if (!current || current.referredByUserId) return; // déjà attribué, ne pas réécrire

    const referrer = await prisma.user.findUnique({ where: { referralCode: code } });
    if (!referrer) return; // code inconnu : on ignore silencieusement

    // Garde anti-fraude : auto-parrainage.
    if (referrer.id === newUserId) return;
    // Garde anti-fraude : cycle de niveau 2 (le parrain aurait pour parrain le filleul).
    if (referrer.referredByUserId === newUserId) return;

    await prisma.user.update({
      where: { id: newUserId },
      data: { referredByUserId: referrer.id },
    });
  } catch (e) {
    console.error("[affiliation] échec attribution parrainage", e);
  }
}

// --- Activation ambassadeur --------------------------------------------------

function randomCode(length = 8): string {
  // Base32 sans ambiguïté (pas de 0/O, 1/I/L) : lisible à l'oral/à l'écrit.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/** Active le statut ambassadeur : génère un code unique, pose les dates. Idempotent. */
export async function activateAmbassador(userId: string): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (existing?.referralCode) return existing.referralCode; // déjà ambassadeur

  // Génère un code unique (retente en cas de collision, improbable mais géré).
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode();
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          referralCode: code,
          ambassadorAt: new Date(),
          ambassadorTermsAt: new Date(),
        },
      });
      return code;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        continue; // collision de code unique : on retente
      }
      throw e;
    }
  }
  throw new Error("Impossible de générer un code de parrainage unique.");
}

// --- Ledger de commissions ---------------------------------------------------

type CreditCommissionReason =
  | "commission_sub_t1"
  | "commission_sub_t2"
  | "commission_school"
  | "payout"
  | "clawback"
  | "adjustment";

/**
 * Écrit un mouvement dans le ledger de commissions, de façon atomique (solde
 * recalculé dans une transaction, cf. pattern grant()/debit() de credits.ts).
 * Idempotence best-effort : une violation de la contrainte unique
 * (beneficiaryId, stripeInvoiceId, tier) est avalée silencieusement (déjà traité).
 */
export async function creditCommission(
  beneficiaryId: string,
  deltaCents: number,
  opts: {
    reason: CreditCommissionReason;
    tier?: number;
    sourceUserId?: string;
    stripeInvoiceId?: string;
    payoutRequestId?: string;
    meta?: Record<string, unknown>;
  },
): Promise<void> {
  if (deltaCents === 0) return;
  try {
    await prisma.$transaction(async (tx) => {
      const last = await tx.commissionLedger.findFirst({
        where: { beneficiaryId },
        orderBy: { createdAt: "desc" },
      });
      const balanceAfter = (last?.balanceAfter ?? 0) + deltaCents;
      await tx.commissionLedger.create({
        data: {
          beneficiaryId,
          delta: deltaCents,
          balanceAfter,
          reason: opts.reason,
          tier: opts.tier ?? null,
          sourceUserId: opts.sourceUserId ?? null,
          stripeInvoiceId: opts.stripeInvoiceId ?? null,
          payoutRequestId: opts.payoutRequestId ?? null,
          meta: (opts.meta ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return; // idempotence : cette facture a déjà généré cette commission
    }
    throw e;
  }
}

/**
 * Calcule et crédite les commissions d'affiliation pour un paiement d'abonnement
 * encaissé (niveau 1 + niveau 2 si applicable). Appelé depuis
 * handleInvoicePaid (src/lib/billing.ts), APRÈS l'octroi des crédits.
 *
 * Best-effort strict : ne lève JAMAIS. Un échec ici ne doit pas faire échouer
 * le traitement du webhook Stripe (sinon Stripe rejoue -> double-crédit de
 * crédits pour l'abonné, cf. handleInvoicePaid).
 */
export async function recordCommissionsForInvoice(opts: {
  payingUserId: string;
  invoiceId: string;
  amountPaidCents: number;
}): Promise<void> {
  try {
    const rates = await resolveCommissionRate();
    if (!rates.enabled) return;
    if (opts.amountPaidCents <= 0) return;

    const payingUser = await prisma.user.findUnique({ where: { id: opts.payingUserId } });
    const tier1Id = payingUser?.referredByUserId;
    if (!tier1Id) return; // personne ne l'a parrainé

    const tier1Cents = Math.round((opts.amountPaidCents * rates.rateTier1) / 100);
    await creditCommission(tier1Id, tier1Cents, {
      reason: "commission_sub_t1",
      tier: 1,
      sourceUserId: opts.payingUserId,
      stripeInvoiceId: opts.invoiceId,
    });

    // Niveau 2 : le parrain du parrain (dérivé, jamais stocké au-delà).
    const tier1User = await prisma.user.findUnique({ where: { id: tier1Id } });
    const tier2Id = tier1User?.referredByUserId;
    if (tier2Id && tier2Id !== opts.payingUserId) {
      const tier2Cents = Math.round((opts.amountPaidCents * rates.rateTier2) / 100);
      await creditCommission(tier2Id, tier2Cents, {
        reason: "commission_sub_t2",
        tier: 2,
        sourceUserId: opts.payingUserId,
        stripeInvoiceId: opts.invoiceId,
      });
    }
  } catch (e) {
    console.error("[affiliation] échec calcul commission", opts.invoiceId, e);
  }
}

// --- Lecture : solde, stats, filleuls ---------------------------------------

/** Solde courant d'un ambassadeur, en centimes. */
export async function getCommissionBalance(userId: string): Promise<number> {
  const last = await prisma.commissionLedger.findFirst({
    where: { beneficiaryId: userId },
    orderBy: { createdAt: "desc" },
  });
  return last?.balanceAfter ?? 0;
}

export type AmbassadorStats = {
  balanceCents: number;
  totalEarnedCents: number;
  totalPaidCents: number;
  tier1Count: number;
  tier2Count: number;
  activeReferredCount: number;
};

/** Statistiques agrégées pour l'espace ambassadeur. */
export async function getAmbassadorStats(userId: string): Promise<AmbassadorStats> {
  const [balanceCents, ledgerRows, tier1Users] = await Promise.all([
    getCommissionBalance(userId),
    prisma.commissionLedger.findMany({ where: { beneficiaryId: userId } }),
    prisma.user.findMany({ where: { referredByUserId: userId }, select: { id: true } }),
  ]);

  let totalEarnedCents = 0;
  let totalPaidCents = 0;
  for (const row of ledgerRows) {
    if (row.delta > 0) totalEarnedCents += row.delta;
    if (row.reason === "payout") totalPaidCents += Math.abs(row.delta);
  }

  const tier1Ids = tier1Users.map((u) => u.id);
  const tier1Count = tier1Ids.length;
  const tier2Count =
    tier1Ids.length > 0
      ? await prisma.user.count({ where: { referredByUserId: { in: tier1Ids } } })
      : 0;

  const activeReferredCount =
    tier1Ids.length > 0
      ? await prisma.userSubscription.count({
          where: { userId: { in: tier1Ids }, status: "active" },
        })
      : 0;

  return { balanceCents, totalEarnedCents, totalPaidCents, tier1Count, tier2Count, activeReferredCount };
}

export type ReferralRow = {
  maskedId: string;
  active: boolean;
  commissionGeneratedCents: number;
};

/** Identifiant masqué pour l'affichage RGPD (jamais l'email/nom d'un filleul). */
function maskUserId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return `#${hash.toString(16).slice(0, 4).toUpperCase().padStart(4, "0")}`;
}

/** Liste des filleuls DIRECTS d'un ambassadeur, anonymisée (RGPD — jamais email/nom). */
export async function getReferralList(userId: string): Promise<ReferralRow[]> {
  const referred = await prisma.user.findMany({
    where: { referredByUserId: userId },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  if (referred.length === 0) return [];

  const ids = referred.map((u) => u.id);
  const [subs, commissions] = await Promise.all([
    prisma.userSubscription.findMany({ where: { userId: { in: ids } } }),
    prisma.commissionLedger.findMany({
      where: { beneficiaryId: userId, sourceUserId: { in: ids }, delta: { gt: 0 } },
    }),
  ]);
  const activeByUser = new Set(subs.filter((s) => s.status === "active").map((s) => s.userId));
  const commissionByUser = new Map<string, number>();
  for (const c of commissions) {
    commissionByUser.set(c.sourceUserId!, (commissionByUser.get(c.sourceUserId!) ?? 0) + c.delta);
  }

  return referred.map((u) => ({
    maskedId: `Filleul ${maskUserId(u.id)}`,
    active: activeByUser.has(u.id),
    commissionGeneratedCents: commissionByUser.get(u.id) ?? 0,
  }));
}

/** Historique des mouvements de commission (le plus récent d'abord). */
export async function getCommissionHistory(userId: string, take = 30) {
  return prisma.commissionLedger.findMany({
    where: { beneficiaryId: userId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

// --- Demandes de paiement -----------------------------------------------------

const OPEN_PAYOUT_STATUSES = ["pending", "invoice_received"] as const;

/** Demande de paiement en cours (pending/invoice_received) d'un ambassadeur, s'il y en a une. */
export async function getActivePayoutRequest(userId: string) {
  return prisma.payoutRequest.findFirst({
    where: { ambassadorId: userId, status: { in: [...OPEN_PAYOUT_STATUSES] } },
    orderBy: { createdAt: "desc" },
  });
}

/** Historique des demandes de paiement d'un ambassadeur (la plus récente d'abord). */
export async function getPayoutHistory(userId: string, take = 20) {
  return prisma.payoutRequest.findMany({
    where: { ambassadorId: userId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export type CreatePayoutResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Crée une demande de paiement pour le solde courant. Refuse si le solde est
 * sous le seuil, ou si une demande est déjà en cours (pending/invoice_received).
 * Le solde n'est PAS remis à zéro ici — seulement quand l'admin marque « payé ».
 */
export async function createPayoutRequest(userId: string): Promise<CreatePayoutResult> {
  const rates = await resolveCommissionRate();
  const balance = await getCommissionBalance(userId);
  if (balance < rates.payoutMinCents) {
    return { ok: false, message: "Solde insuffisant pour demander un paiement." };
  }
  const active = await getActivePayoutRequest(userId);
  if (active) {
    return { ok: false, message: "Une demande de paiement est déjà en cours." };
  }
  await prisma.payoutRequest.create({
    data: { ambassadorId: userId, amountCents: balance, status: "pending" },
  });
  return { ok: true };
}

/** Signale que la facture a été envoyée par email pour une demande en cours. */
export async function markPayoutInvoiceSent(
  payoutRequestId: string,
  userId: string,
): Promise<void> {
  await prisma.payoutRequest.updateMany({
    where: { id: payoutRequestId, ambassadorId: userId, status: "pending" },
    data: { invoiceEmailAt: new Date(), status: "invoice_received" },
  });
}

// --- Fonctions admin (/admin/affiliation) ------------------------------------

export type AmbassadorRow = {
  userId: string;
  email: string;
  referralCode: string;
  tier1Count: number;
  tier2Count: number;
  totalEarnedCents: number;
  balanceCents: number;
  totalPaidCents: number;
};

/** Liste des ambassadeurs actifs, triée par solde décroissant (qui payer en premier). */
export async function listAmbassadors(): Promise<AmbassadorRow[]> {
  const ambassadors = await prisma.user.findMany({
    where: { referralCode: { not: null } },
    select: { id: true, email: true, referralCode: true },
  });
  if (ambassadors.length === 0) return [];

  const ids = ambassadors.map((a) => a.id);
  const [ledgerRows, tier1Rows] = await Promise.all([
    prisma.commissionLedger.findMany({ where: { beneficiaryId: { in: ids } } }),
    prisma.user.findMany({ where: { referredByUserId: { in: ids } }, select: { id: true, referredByUserId: true } }),
  ]);

  const tier1ByAmbassador = new Map<string, string[]>();
  for (const u of tier1Rows) {
    const arr = tier1ByAmbassador.get(u.referredByUserId!) ?? [];
    arr.push(u.id);
    tier1ByAmbassador.set(u.referredByUserId!, arr);
  }
  const allTier1Ids = tier1Rows.map((u) => u.id);
  const tier2Rows =
    allTier1Ids.length > 0
      ? await prisma.user.findMany({
          where: { referredByUserId: { in: allTier1Ids } },
          select: { referredByUserId: true },
        })
      : [];
  const tier2CountByTier1 = new Map<string, number>();
  for (const u of tier2Rows) {
    tier2CountByTier1.set(u.referredByUserId!, (tier2CountByTier1.get(u.referredByUserId!) ?? 0) + 1);
  }

  const rowsByAmbassador = new Map<string, typeof ledgerRows>();
  for (const row of ledgerRows) {
    const arr = rowsByAmbassador.get(row.beneficiaryId) ?? [];
    arr.push(row);
    rowsByAmbassador.set(row.beneficiaryId, arr);
  }

  return ambassadors.map((a) => {
    const rows = rowsByAmbassador.get(a.id) ?? [];
    let totalEarnedCents = 0;
    let totalPaidCents = 0;
    let balanceCents = 0;
    let lastCreatedAt = 0;
    for (const row of rows) {
      if (row.delta > 0) totalEarnedCents += row.delta;
      if (row.reason === "payout") totalPaidCents += Math.abs(row.delta);
      const t = row.createdAt.getTime();
      if (t >= lastCreatedAt) {
        lastCreatedAt = t;
        balanceCents = row.balanceAfter;
      }
    }
    const tier1Ids = tier1ByAmbassador.get(a.id) ?? [];
    return {
      userId: a.id,
      email: a.email,
      referralCode: a.referralCode!,
      tier1Count: tier1Ids.length,
      tier2Count: tier1Ids.reduce((sum, id) => sum + (tier2CountByTier1.get(id) ?? 0), 0),
      totalEarnedCents,
      balanceCents,
      totalPaidCents,
    };
  }).sort((a, b) => b.balanceCents - a.balanceCents);
}

export type PayoutRequestRow = {
  id: string;
  ambassadorId: string;
  ambassadorEmail: string;
  amountCents: number;
  status: string;
  invoiceEmailAt: Date | null;
  createdAt: Date;
};

/** File des demandes de paiement en cours (pending/invoice_received), la plus ancienne d'abord. */
export async function listOpenPayoutRequests(): Promise<PayoutRequestRow[]> {
  const rows = await prisma.payoutRequest.findMany({
    where: { status: { in: [...OPEN_PAYOUT_STATUSES] } },
    orderBy: { createdAt: "asc" },
  });
  if (rows.length === 0) return [];
  const ambassadors = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.ambassadorId) } },
    select: { id: true, email: true },
  });
  const emailById = new Map(ambassadors.map((a) => [a.id, a.email]));
  return rows.map((r) => ({
    id: r.id,
    ambassadorId: r.ambassadorId,
    ambassadorEmail: emailById.get(r.ambassadorId) ?? "—",
    amountCents: r.amountCents,
    status: r.status,
    invoiceEmailAt: r.invoiceEmailAt,
    createdAt: r.createdAt,
  }));
}

/**
 * Marque une demande de paiement comme payée : écrit une ligne `payout` négative
 * (le solde de l'ambassadeur revient à 0, ou au résidu accumulé depuis la demande)
 * et clôt la demande. Transaction atomique.
 */
export async function markPayoutPaid(payoutRequestId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const req = await tx.payoutRequest.findUnique({ where: { id: payoutRequestId } });
    if (!req || req.status === "paid") return;
    const last = await tx.commissionLedger.findFirst({
      where: { beneficiaryId: req.ambassadorId },
      orderBy: { createdAt: "desc" },
    });
    const balanceAfter = (last?.balanceAfter ?? 0) - req.amountCents;
    await tx.commissionLedger.create({
      data: {
        beneficiaryId: req.ambassadorId,
        delta: -req.amountCents,
        balanceAfter,
        reason: "payout",
        payoutRequestId: req.id,
      },
    });
    await tx.payoutRequest.update({
      where: { id: req.id },
      data: { status: "paid", paidAt: new Date() },
    });
  });
}

/** Rejette une demande de paiement, sans mouvement de solde. */
export async function rejectPayoutRequest(payoutRequestId: string): Promise<void> {
  await prisma.payoutRequest.updateMany({
    where: { id: payoutRequestId, status: { in: [...OPEN_PAYOUT_STATUSES] } },
    data: { status: "rejected" },
  });
}

export type CreditByEmailResult = { ok: boolean; message: string };

/** Crédite manuellement une commission « école » (volet B2B, attribution manuelle). */
export async function creditSchoolCommissionByEmail(
  email: string,
  amountCents: number,
  note: string,
): Promise<CreditByEmailResult> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { ok: false, message: "Aucun compte avec cet email." };
  await creditCommission(user.id, amountCents, {
    reason: "commission_school",
    meta: note ? { note } : undefined,
  });
  return { ok: true, message: `Commission école créditée à ${email}.` };
}

/** Ajustement manuel (correction d'erreur) du solde d'un ambassadeur. */
export async function adjustCommissionByEmail(
  email: string,
  deltaCents: number,
  note: string,
): Promise<CreditByEmailResult> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { ok: false, message: "Aucun compte avec cet email." };
  await creditCommission(user.id, deltaCents, {
    reason: "adjustment",
    meta: note ? { note } : undefined,
  });
  return { ok: true, message: `Ajustement appliqué à ${email}.` };
}
