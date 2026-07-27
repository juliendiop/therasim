// Garde-fous d'usage loyal — créés par la refonte « tout inclus ».
//
// Le coût marginal d'une mise en situation IA (~0,01–0,03 €) est négligeable devant
// le revenu : ces plafonds ne sont donc PAS des limites de produit, mais des
// garde-fous ANTI-ABUS (bots, usage automatisé). Deux surfaces couvertes :
//  1. mises en situation IA (mini-scènes + entretiens) — plafond journalier + filet
//     mensuel très haut, avec alerte admin au seuil ;
//  2. évaluations de drills « production » — la SEULE dépense IA non facturée et
//     désormais non bornée par le catalogue (tout le catalogue est ouvert au gratuit).
//
// Tout est paramétrable en base (app_config) via /admin/credits — jamais codé en dur.

import "server-only";
import { prisma } from "./prisma";
import { getConfig } from "./config";
import { rateLimit } from "./rate-limit";
import { isEmailConfigured, sendAdminUsageAlert } from "./email";

/** Valeurs par défaut (surchargées en admin). Calibrées TRÈS haut : invisibles à un
 *  usage normal, elles ne mordent que sur un usage manifestement automatisé. */
export const USAGE_DEFAULTS = {
  simDaily: 25, // mises en situation IA / utilisateur / 24 h
  simMonthly: 400, // filet mensuel de dernier recours (par utilisateur)
  simAlert: 150, // seuil d'alerte admin (mises en situation sur 30 j)
  drillDaily: 120, // évaluations de drills « production » / utilisateur / 24 h
};

export type UsageSettings = {
  simDaily: number;
  simMonthly: number;
  simAlert: number;
  drillDaily: number;
};

async function num(key: string, dflt: number): Promise<number> {
  const v = await getConfig(key);
  const n = v == null ? NaN : parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : dflt;
}

/** Plafonds d'usage loyal (admin), avec repli sur les valeurs par défaut. */
export async function usageSettings(): Promise<UsageSettings> {
  const [simDaily, simMonthly, simAlert, drillDaily] = await Promise.all([
    num("limits.sim.daily", USAGE_DEFAULTS.simDaily),
    num("limits.sim.monthly", USAGE_DEFAULTS.simMonthly),
    num("limits.sim.alert", USAGE_DEFAULTS.simAlert),
    num("limits.drill.daily", USAGE_DEFAULTS.drillDaily),
  ]);
  return { simDaily, simMonthly, simAlert, drillDaily };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * DAY_MS;

/** Nombre de mises en situation lancées par un utilisateur sur une fenêtre glissante. */
export async function countSims(userId: string, windowMs: number): Promise<number> {
  return prisma.simSession.count({
    where: { userId, createdAt: { gte: new Date(Date.now() - windowMs) } },
  });
}

export type SimAllowance = { ok: true } | { ok: false; scope: "daily" | "monthly" };

/**
 * Vérifie l'usage loyal AVANT de lancer une mise en situation (appelée avant tout
 * débit de crédit). Best-effort : un incident ne doit jamais bloquer un utilisateur
 * légitime. Déclenche au passage l'alerte admin (une fois par mois) si le seuil est
 * franchi — sans jamais refuser tant que le plafond mensuel n'est pas atteint.
 */
export async function checkSimulationAllowance(userId: string): Promise<SimAllowance> {
  try {
    const s = await usageSettings();
    const [today, month] = await Promise.all([
      countSims(userId, DAY_MS),
      countSims(userId, MONTH_MS),
    ]);

    // Alerte admin best-effort au franchissement du seuil (avant tout refus).
    if (month + 1 >= s.simAlert) void maybeAlertAdmin(userId, month + 1, s.simAlert);

    if (today >= s.simDaily) return { ok: false, scope: "daily" };
    if (month >= s.simMonthly) return { ok: false, scope: "monthly" };
    return { ok: true };
  } catch (e) {
    console.error("[usage] contrôle des mises en situation échoué, on laisse passer", userId, e);
    return { ok: true };
  }
}

async function maybeAlertAdmin(userId: string, count: number, threshold: number): Promise<void> {
  try {
    if (!isEmailConfigured()) return;
    const ym = new Date().toISOString().slice(0, 7); // dédup par mois calendaire
    const once = await rateLimit(`sim-alert:${userId}:${ym}`, { max: 1, windowMs: 40 * DAY_MS });
    if (!once.ok) return; // déjà alerté ce mois-ci
    const [user, admin] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
      prisma.user.findFirst({ where: { role: "super_admin" }, select: { email: true } }),
    ]);
    if (!user || !admin) return;
    await sendAdminUsageAlert(admin.email, {
      userEmail: user.email,
      count,
      threshold,
      period: ym,
    });
  } catch (e) {
    console.error("[usage] alerte admin non envoyée", userId, e);
  }
}

/**
 * Garde-fou anti-abus sur les évaluations de drills « production » (appel IA gratuit,
 * non facturé en crédits). Renvoie `false` si le plafond journalier est atteint.
 * Best-effort : un incident de base laisse passer.
 */
export async function checkDrillProductionAllowance(userId: string): Promise<boolean> {
  try {
    const s = await usageSettings();
    const r = await rateLimit(`drill-prod:${userId}`, { max: s.drillDaily, windowMs: DAY_MS });
    return r.ok;
  } catch {
    return true;
  }
}
