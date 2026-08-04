// Types partagés de la journalisation des coûts LLM — module PUR (aucun `server-only`,
// aucune dépendance Prisma) pour rester importable depuis les tests et les scripts.
//
// Convention du schéma : les statuts sont des `String` + union TS `as const` + garde zod,
// jamais un enum Prisma (cf. 03_DECISIONS.md, gabarit src/lib/beta-status.ts).

import { z } from "zod";

/** Compteurs de tokens d'un appel. Les deux champs de cache sont DISTINCTS :
 *  l'écriture de cache coûte plus qu'un token d'entrée, la lecture beaucoup moins —
 *  les fusionner fausserait le coût dans les deux sens. Mistral : cache à 0. */
export type LlmTokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
};

export function emptyUsage(): LlmTokenUsage {
  return { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 };
}

/** Statut d'une ligne de journalisation. `estimated` = tokens estimés (usage non renvoyé). */
export const LLM_CALL_STATUS = ["ok", "error", "estimated"] as const;
export type LlmCallStatus = (typeof LLM_CALL_STATUS)[number];
export const llmCallStatusSchema = z.enum(LLM_CALL_STATUS);

/** Niveau pédagogique rattaché à l'appel (drills N1, mini-scène N2, simulation N3, autre). */
export const LLM_LEVELS = ["1", "2", "3", "autre"] as const;
export type LlmLevel = (typeof LLM_LEVELS)[number];
export const llmLevelSchema = z.enum(LLM_LEVELS);
