// Agrégations de coût LLM pour /admin/couts. Toutes les mesures viennent de la table
// LlmCall (coûts figés) et du grand livre de crédits (débits réels). Serveur uniquement.
//
// Trois chiffres qui décident de tout : coût par crédit débité, coût par séance N3/N2,
// coût mensuel par utilisateur actif. Plus trois lignes isolées (drills gratuits, démo,
// abonnés « sans compter ») qui échappent à la mesure fondée sur les crédits.

import "server-only";
import { prisma } from "./prisma";
import { getConfig, setConfig } from "./config";
import { getPricingEntries } from "./llm-log";
import { pickEffectivePrice } from "./llm-pricing";

const CENTS = (eur: number) => Math.round(eur * 100 * 100) / 100; // euros -> centimes (2 déc.)

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function startOfMonth(at = new Date()): Date {
  return new Date(at.getFullYear(), at.getMonth(), 1);
}
function monthKey(at = new Date()): string {
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}`;
}
function dayKey(at = new Date()): string {
  return at.toISOString().slice(0, 10);
}
function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

/** Coût RÉEL de la démo publique aujourd'hui, en centimes (remplace l'ancienne estimation). */
export async function demoCostTodayCents(): Promise<number> {
  const r = await prisma.llmCall.aggregate({
    _sum: { costEur: true },
    where: { userId: null, createdAt: { gte: startOfToday() } },
  });
  return CENTS(r._sum.costEur ?? 0);
}

// --- Seuils d'alerte (configurables) ---------------------------------------

const ALERT_USER_MONTHLY_KEY = "couts.alert.user_monthly_eur";
const ALERT_DAILY_GLOBAL_KEY = "couts.alert.daily_global_eur";
const COST_TARGET_PER_CREDIT_KEY = "couts.target.per_credit_eur";
const DEFAULT_USER_MONTHLY = 5;
const DEFAULT_DAILY_GLOBAL = 20;
const DEFAULT_TARGET_PER_CREDIT = 0.1;

async function numConfig(key: string, def: number): Promise<number> {
  const raw = await getConfig(key);
  const n = raw ? parseFloat(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : def;
}

export async function costThresholds() {
  const [userMonthly, dailyGlobal, targetPerCredit] = await Promise.all([
    numConfig(ALERT_USER_MONTHLY_KEY, DEFAULT_USER_MONTHLY),
    numConfig(ALERT_DAILY_GLOBAL_KEY, DEFAULT_DAILY_GLOBAL),
    numConfig(COST_TARGET_PER_CREDIT_KEY, DEFAULT_TARGET_PER_CREDIT),
  ]);
  return { userMonthly, dailyGlobal, targetPerCredit };
}

export async function setCostThresholds(input: {
  userMonthly?: number;
  dailyGlobal?: number;
  targetPerCredit?: number;
}): Promise<void> {
  if (input.userMonthly && input.userMonthly > 0)
    await setConfig(ALERT_USER_MONTHLY_KEY, String(input.userMonthly));
  if (input.dailyGlobal && input.dailyGlobal > 0)
    await setConfig(ALERT_DAILY_GLOBAL_KEY, String(input.dailyGlobal));
  if (input.targetPerCredit && input.targetPerCredit > 0)
    await setConfig(COST_TARGET_PER_CREDIT_KEY, String(input.targetPerCredit));
}

// --- Le tableau de bord ----------------------------------------------------

export type CostDashboard = Awaited<ReturnType<typeof getCostDashboard>>;

export async function getCostDashboard(params: { from: Date; to: Date }) {
  const { from, to } = params;
  const inPeriod = { createdAt: { gte: from, lte: to } };
  const mStart = startOfMonth();
  const inMonth = { createdAt: { gte: mStart } };

  // 1) Par usage : dépense, appels, coût moyen, + tokens pour le taux de cache.
  const byUsageRows = await prisma.llmCall.groupBy({
    by: ["usage"],
    where: inPeriod,
    _sum: {
      costEur: true,
      inputTokens: true,
      cacheReadTokens: true,
      cacheCreationTokens: true,
    },
    _count: { _all: true },
  });
  const byUsage = byUsageRows
    .map((r) => {
      const cost = r._sum.costEur ?? 0;
      const calls = r._count._all;
      const input = r._sum.inputTokens ?? 0;
      const cacheRead = r._sum.cacheReadTokens ?? 0;
      const cacheCreation = r._sum.cacheCreationTokens ?? 0;
      const promptTotal = input + cacheRead + cacheCreation;
      return {
        usage: r.usage,
        costCents: CENTS(cost),
        calls,
        avgCents: calls > 0 ? CENTS(cost / calls) : 0,
        // Taux de lecture de cache : lectures / tokens d'entrée totaux (levier de marge).
        cacheReadRate: promptTotal > 0 ? Math.round((cacheRead / promptTotal) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.costCents - a.costCents);

  const totalCostEur = byUsageRows.reduce((s, r) => s + (r._sum.costEur ?? 0), 0);
  const totalCalls = byUsageRows.reduce((s, r) => s + r._count._all, 0);

  // 2) Coût par crédit débité = coût total ÷ crédits réellement débités (grand livre).
  const debits = await prisma.creditLedger.aggregate({
    _sum: { delta: true },
    where: { reason: { in: ["consume_miniscene", "consume_simulation"] }, ...inPeriod },
  });
  const creditsDebited = Math.abs(debits._sum.delta ?? 0);
  const perCreditEur = creditsDebited > 0 ? totalCostEur / creditsDebited : 0;

  // 3) Coût moyen d'une séance N3 / N2 : coût des appels rattachés, par séance.
  const sessions = await prisma.simSession.findMany({
    where: inPeriod,
    select: { id: true, kind: true },
  });
  const sessionKind = new Map(sessions.map((s) => [s.id, s.kind]));
  const sessionCostRows = await prisma.llmCall.groupBy({
    by: ["simSessionId"],
    where: { simSessionId: { in: sessions.map((s) => s.id) }, ...inPeriod },
    _sum: { costEur: true },
  });
  let n3Cost = 0;
  let n3Count = 0;
  let n2Cost = 0;
  let n2Count = 0;
  for (const row of sessionCostRows) {
    if (!row.simSessionId) continue;
    const kind = sessionKind.get(row.simSessionId);
    const c = row._sum.costEur ?? 0;
    if (kind === "simulation") {
      n3Cost += c;
      n3Count++;
    } else if (kind === "miniscene") {
      n2Cost += c;
      n2Count++;
    }
  }
  const perN3Cents = n3Count > 0 ? CENTS(n3Cost / n3Count) : 0;
  const perN2Cents = n2Count > 0 ? CENTS(n2Cost / n2Count) : 0;

  // Coût mensuel par utilisateur (une seule agrégation, réutilisée plus bas).
  const monthlyUserRows = await prisma.llmCall.groupBy({
    by: ["userId"],
    where: { userId: { not: null }, ...inMonth },
    _sum: { costEur: true },
  });
  const monthlyByUser = new Map<string, number>();
  for (const r of monthlyUserRows) {
    if (r.userId) monthlyByUser.set(r.userId, r._sum.costEur ?? 0);
  }
  const monthlyCosts = [...monthlyByUser.values()].sort((a, b) => a - b);

  // 4) Distribution du coût mensuel par utilisateur actif.
  const perUser = {
    activeUsers: monthlyCosts.length,
    medianCents: CENTS(median(monthlyCosts)),
    p90Cents: CENTS(percentile(monthlyCosts, 90)),
    maxCents: CENTS(monthlyCosts.at(-1) ?? 0),
  };

  // 5) Top 10 utilisateurs du mois + leur forfait.
  const topIds = [...monthlyByUser.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id);
  const [topUsers, topSubs] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: topIds } }, select: { id: true, email: true } }),
    prisma.userSubscription.findMany({ where: { userId: { in: topIds } } }),
  ]);
  const plans = await prisma.subscriptionPlan.findMany();
  const planById = new Map(plans.map((p) => [p.id, p]));
  const subByUser = new Map(topSubs.map((s) => [s.userId, s]));
  const emailById = new Map(topUsers.map((u) => [u.id, u.email]));
  const top10 = topIds.map((id) => {
    const sub = subByUser.get(id);
    const plan = sub ? planById.get(sub.planId) : null;
    return {
      email: emailById.get(id) ?? "—",
      forfait: plan ? plan.label : "Découverte",
      costCents: CENTS(monthlyByUser.get(id) ?? 0),
    };
  });

  // 6) Marge brute par forfait : recette mensuelle − coût IA moyen de ses abonnés.
  const activeSubs = await prisma.userSubscription.findMany({
    where: { status: { in: ["active", "trialing"] } },
  });
  const subsByPlan = new Map<string, string[]>(); // planId -> userIds
  for (const s of activeSubs) {
    const arr = subsByPlan.get(s.planId) ?? [];
    arr.push(s.userId);
    subsByPlan.set(s.planId, arr);
  }
  const margins = plans
    .filter((p) => (subsByPlan.get(p.id)?.length ?? 0) > 0)
    .map((p) => {
      const userIds = subsByPlan.get(p.id) ?? [];
      const n = userIds.length;
      const iaCost = userIds.reduce((s, uid) => s + (monthlyByUser.get(uid) ?? 0), 0);
      const revenuePerSubEur = p.priceEurCents / 100;
      const iaCostPerSubEur = n > 0 ? iaCost / n : 0;
      return {
        forfait: p.label,
        subscribers: n,
        unlimited: p.monthlyCredits === null,
        revenuePerSubCents: CENTS(revenuePerSubEur),
        iaCostPerSubCents: CENTS(iaCostPerSubEur),
        marginPerSubCents: CENTS(revenuePerSubEur - iaCostPerSubEur),
      };
    })
    .sort((a, b) => a.marginPerSubCents - b.marginPerSubCents);

  // a) Drills de production GRATUITS : usage evaluateur, hors séance, utilisateur connu.
  const freeDrill = await prisma.llmCall.aggregate({
    _sum: { costEur: true },
    _count: { _all: true },
    where: { usage: "evaluateur", simSessionId: null, userId: { not: null }, ...inPeriod },
  });
  const freeDrillUsers = await prisma.llmCall.findMany({
    where: { usage: "evaluateur", simSessionId: null, userId: { not: null }, ...inPeriod },
    distinct: ["userId"],
    select: { userId: true },
  });
  const freeDrillCostEur = freeDrill._sum.costEur ?? 0;
  const freeDrills = {
    costCents: CENTS(freeDrillCostEur),
    calls: freeDrill._count._all,
    activeUsers: freeDrillUsers.length,
    perUserCents: freeDrillUsers.length > 0 ? CENTS(freeDrillCostEur / freeDrillUsers.length) : 0,
  };

  // b) Démo publique : userId nul = coût d'acquisition.
  const demoAgg = await prisma.llmCall.aggregate({
    _sum: { costEur: true },
    _count: { _all: true },
    where: { userId: null, ...inPeriod },
  });
  const demo = { costCents: CENTS(demoAgg._sum.costEur ?? 0), calls: demoAgg._count._all };

  // c) Abonnés « sans compter » : leur débit de crédits est court-circuité → coût mensuel en clair.
  const unlimitedPlanIds = plans.filter((p) => p.monthlyCredits === null).map((p) => p.id);
  const unlimitedSubs = activeSubs.filter((s) => unlimitedPlanIds.includes(s.planId));
  const unlimitedUserIds = unlimitedSubs.map((s) => s.userId);
  const unlimitedUsers = await prisma.user.findMany({
    where: { id: { in: unlimitedUserIds } },
    select: { id: true, email: true },
  });
  const emailUnlimited = new Map(unlimitedUsers.map((u) => [u.id, u.email]));
  const sansCompter = unlimitedSubs
    .map((s) => ({
      email: emailUnlimited.get(s.userId) ?? "—",
      forfait: planById.get(s.planId)?.label ?? "—",
      monthlyCostCents: CENTS(monthlyByUser.get(s.userId) ?? 0),
    }))
    .sort((a, b) => b.monthlyCostCents - a.monthlyCostCents);

  // Modèles vus sur la période SANS tarif renseigné → à compléter dans /admin/modeles.
  const seen = await prisma.llmCall.groupBy({ by: ["provider", "model"], where: inPeriod });
  const pricing = await getPricingEntries();
  const missingPricing = seen
    .filter((r) => !pickEffectivePrice(pricing, r.provider, r.model, new Date()))
    .map((r) => ({ provider: r.provider, model: r.model }));

  const thresholds = await costThresholds();

  return {
    period: { from, to },
    monthLabel: monthKey(),
    totalCents: CENTS(totalCostEur),
    totalCalls,
    byUsage,
    perCredit: {
      costCents: CENTS(totalCostEur),
      credits: creditsDebited,
      perCreditCents: CENTS(perCreditEur),
      targetCents: CENTS(thresholds.targetPerCredit),
      over: perCreditEur > thresholds.targetPerCredit,
    },
    sessions: { perN3Cents, n3Count, perN2Cents, n2Count },
    perUser,
    top10,
    margins,
    freeDrills,
    demo,
    sansCompter,
    missingPricing,
    thresholds,
  };
}

// --- Alertes de coût (écrites en base) -------------------------------------

export type CostAlertView = {
  kind: string;
  label: string;
  amountCents: number;
  thresholdCents: number;
};

/**
 * Détecte les franchissements du jour/mois et les ÉCRIT en base (idempotent par fenêtre),
 * pour qu'un envoi périodique puisse s'y brancher sans réinstrumenter. Renvoie les alertes
 * actives pour l'affichage. Complémentaire de /admin/usage : celui-ci BLOQUE en temps réel
 * l'usage abusif ; l'alerte de coût, elle, OBSERVE la dépense et signale (dont les abonnés
 * « sans compter », invisibles côté crédits).
 */
export async function detectAndRecordCostAlerts(): Promise<CostAlertView[]> {
  const { userMonthly, dailyGlobal } = await costThresholds();
  const alerts: CostAlertView[] = [];

  // Dépense globale du jour.
  const todayAgg = await prisma.llmCall.aggregate({
    _sum: { costEur: true },
    where: { createdAt: { gte: startOfToday() } },
  });
  const todayEur = todayAgg._sum.costEur ?? 0;
  if (todayEur > dailyGlobal) {
    await recordAlert("daily_global", "global", dayKey(), todayEur, dailyGlobal);
    alerts.push({
      kind: "daily_global",
      label: "Dépense IA du jour",
      amountCents: CENTS(todayEur),
      thresholdCents: CENTS(dailyGlobal),
    });
  }

  // Dépense mensuelle par utilisateur.
  const monthRows = await prisma.llmCall.groupBy({
    by: ["userId"],
    where: { userId: { not: null }, createdAt: { gte: startOfMonth() } },
    _sum: { costEur: true },
  });
  const overIds: { userId: string; eur: number }[] = [];
  for (const r of monthRows) {
    const eur = r._sum.costEur ?? 0;
    if (r.userId && eur > userMonthly) overIds.push({ userId: r.userId, eur });
  }
  if (overIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: overIds.map((o) => o.userId) } },
      select: { id: true, email: true },
    });
    const email = new Map(users.map((u) => [u.id, u.email]));
    for (const o of overIds.sort((a, b) => b.eur - a.eur)) {
      await recordAlert("user_monthly", o.userId, monthKey(), o.eur, userMonthly);
      alerts.push({
        kind: "user_monthly",
        label: `Abonné coûteux : ${email.get(o.userId) ?? o.userId}`,
        amountCents: CENTS(o.eur),
        thresholdCents: CENTS(userMonthly),
      });
    }
  }

  return alerts;
}

async function recordAlert(
  kind: string,
  subjectKey: string,
  windowKey: string,
  amountEur: number,
  thresholdEur: number,
): Promise<void> {
  try {
    await prisma.costAlert.upsert({
      where: { kind_subjectKey_windowKey: { kind, subjectKey, windowKey } },
      update: { amountEur, thresholdEur },
      create: { kind, subjectKey, windowKey, amountEur, thresholdEur },
    });
  } catch (e) {
    console.error("[cost-alert] écriture ignorée :", e);
  }
}
