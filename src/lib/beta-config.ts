// Lecture à l'exécution des réglages de la bêta (app_config), avec repli sur les
// valeurs par défaut de BETA_CONFIG. Même mécanisme que les autres réglages admin
// (getConfig). `server-only` : réservé à l'app ; les scripts lisent app_config
// directement avec les mêmes clés/défauts (cf. beta-constants.ts).

import "server-only";
import { getConfig } from "./config";
import { BETA_CONFIG } from "./beta-constants";

async function readInt(entry: { key: string; default: number }): Promise<number> {
  const v = await getConfig(entry.key);
  const n = v == null ? NaN : parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : entry.default;
}

async function readStr(entry: { key: string; default: string }): Promise<string> {
  const v = (await getConfig(entry.key))?.trim();
  return v ? v : entry.default;
}

/** Réglages bêta lus à l'exécution (une seule source : BETA_CONFIG + app_config). */
export const betaConfig = {
  planKey: () => readStr(BETA_CONFIG.planKey),
  trialDays: () => readInt(BETA_CONFIG.trialDays),
  midTrialDay: () => readInt(BETA_CONFIG.midTrialDay),
  bilanDay: () => readInt(BETA_CONFIG.bilanDay),
  nudgeHours: () => readInt(BETA_CONFIG.nudgeHours),
  feedbackSims: () => readInt(BETA_CONFIG.feedbackSims),
  feedbackLatestDay: () => readInt(BETA_CONFIG.feedbackLatestDay),
};
