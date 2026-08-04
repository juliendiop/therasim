// Tarification LLM — module PUR (aucun `server-only`, aucune dépendance Prisma) pour
// rester testable hors Next. La LECTURE/ÉCRITURE des tarifs en base (app_config) vit
// dans src/lib/llm-log.ts (serveur) ; ici, uniquement les types et le calcul.
//
// Principe : aucun tarif en dur. Le coût d'une ligne est figé à l'instant de l'appel,
// au tarif alors en vigueur — un historique recalculé au tarif du jour serait faux.

import type { LlmTokenUsage } from "./llm-usage";

/** Prix d'un modèle, en EUROS par MILLION de tokens, pour chaque catégorie. */
export type ModelPrice = {
  inputPerM: number; // entrée « fraîche »
  outputPerM: number; // sortie
  cacheWritePerM: number; // écriture de cache (Anthropic ; > entrée)
  cacheReadPerM: number; // lecture de cache (Anthropic ; << entrée)
};

/** Une entrée de la table de tarifs : un prix daté pour un couple fournisseur/modèle. */
export type PricingEntry = ModelPrice & {
  provider: string;
  model: string;
  effectiveFrom: string; // ISO (date d'effet) ; on retient la plus récente <= instant de l'appel
};

/**
 * Prix en vigueur pour (provider, model) à l'instant `at` : l'entrée à la date d'effet
 * la plus récente antérieure ou égale à `at`. `null` si aucun tarif n'est renseigné —
 * l'appel est alors journalisé avec un coût 0, et le modèle remonte dans « tarifs manquants ».
 */
export function pickEffectivePrice(
  entries: PricingEntry[],
  provider: string,
  model: string,
  at: Date,
): ModelPrice | null {
  const t = at.getTime();
  const candidates = entries
    .filter(
      (e) =>
        e.provider === provider &&
        e.model === model &&
        new Date(e.effectiveFrom).getTime() <= t,
    )
    .sort(
      (a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime(),
    );
  const e = candidates[0];
  if (!e) return null;
  return {
    inputPerM: e.inputPerM,
    outputPerM: e.outputPerM,
    cacheWritePerM: e.cacheWritePerM,
    cacheReadPerM: e.cacheReadPerM,
  };
}

/**
 * Coût en euros d'un appel, à partir des compteurs et du prix. Les quatre catégories
 * sont tarifées séparément (l'écriture et la lecture de cache ont leur propre prix).
 * Fonction PURE — couverte par test/llm-cost.test.ts.
 */
export function computeCostEur(tokens: LlmTokenUsage, price: ModelPrice): number {
  return (
    (tokens.inputTokens * price.inputPerM +
      tokens.outputTokens * price.outputPerM +
      tokens.cacheCreationTokens * price.cacheWritePerM +
      tokens.cacheReadTokens * price.cacheReadPerM) /
    1_000_000
  );
}

/**
 * Estimation grossière des tokens quand l'API n'a pas renvoyé l'usage (repli sur les flux
 * Mistral sans usage). ~4 caractères par token — volontairement approximatif ; la ligne
 * sera marquée `estimated`. Une ligne approximative vaut mieux qu'un trou qui fausse les agrégats.
 */
export function estimateTokens(promptText: string, completionText: string): LlmTokenUsage {
  const est = (s: string) => Math.max(0, Math.ceil(s.length / 4));
  return {
    inputTokens: est(promptText),
    outputTokens: est(completionText),
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
  };
}
