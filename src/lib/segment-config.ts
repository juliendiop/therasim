// Lecture à l'exécution des réglages de segmentation (app_config), avec repli sur
// SEGMENT_CONFIG. Même mécanisme que `beta-config.ts`. `server-only` : réservé à
// l'app — `segments.ts` reste pur et importable depuis les tests.
import "server-only";
import { getConfig } from "./config";
import { SEGMENT_CONFIG } from "./segments";

async function readInt(entry: { key: string; default: number }): Promise<number> {
  const v = await getConfig(entry.key);
  const n = v == null ? NaN : parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : entry.default;
}

export const segmentConfig = {
  dormantAfterDays: () => readInt(SEGMENT_CONFIG.dormantAfterDays),
};
