// Écriture d'une ligne de journalisation d'appel LLM (table LlmCall) + lecture/écriture
// des tarifs en configuration (app_config). Serveur uniquement.
//
// Garanties (contraintes du lot) :
// - ne lève JAMAIS : une panne de journalisation part dans les logs, la requête réussit ;
// - AUCUN contenu de prompt ni de réponse n'est stocké — seulement des compteurs (RGPD) ;
// - le coût est FIGÉ au tarif en vigueur à l'instant de l'appel (aucun recalcul rétroactif).

import "server-only";
import { prisma } from "./prisma";
import { getConfig, setConfig, type LlmUsage, type LlmProvider } from "./config";
import type { LlmTokenUsage, LlmCallStatus } from "./llm-usage";
import type { PricingEntry } from "./llm-pricing";
import { pickEffectivePrice, computeCostEur } from "./llm-pricing";
import { currentLlmContext, type LlmContext } from "./llm-context";

const PRICING_KEY = "llm.pricing";

/** Table de tarifs (app_config). Vide tant que rien n'est renseigné → coût 0. */
export async function getPricingEntries(): Promise<PricingEntry[]> {
  const raw = await getConfig(PRICING_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as PricingEntry[]) : [];
  } catch {
    return [];
  }
}

export async function setPricingEntries(entries: PricingEntry[]): Promise<void> {
  await setConfig(PRICING_KEY, JSON.stringify(entries));
}

export type LlmCallRecord = {
  usage: LlmUsage;
  provider: LlmProvider;
  model: string;
  tokens: LlmTokenUsage;
  status: LlmCallStatus;
  durationMs: number;
  error?: string | null;
};

/**
 * Journalise un appel. `ctxOverride` sert aux FLUX : le contexte y est capté à l'ouverture
 * (dans la portée AsyncLocalStorage de l'appelant) puis passé ici, car l'écriture a lieu à
 * la fin du flux, hors de cette portée. Hors flux, on lit le contexte ambiant.
 */
export async function logLlmCall(rec: LlmCallRecord, ctxOverride?: LlmContext): Promise<void> {
  try {
    const ctx = ctxOverride ?? currentLlmContext();
    const entries = await getPricingEntries();
    const price = pickEffectivePrice(entries, rec.provider, rec.model, new Date());
    const costEur = price ? computeCostEur(rec.tokens, price) : 0;

    await prisma.llmCall.create({
      data: {
        usage: rec.usage,
        provider: rec.provider,
        model: rec.model,
        inputTokens: rec.tokens.inputTokens,
        outputTokens: rec.tokens.outputTokens,
        cacheCreationTokens: rec.tokens.cacheCreationTokens,
        cacheReadTokens: rec.tokens.cacheReadTokens,
        costEur,
        userId: ctx.userId ?? null,
        tenantId: ctx.tenantId ?? null,
        frameworkId: ctx.frameworkId ?? null,
        simSessionId: ctx.simSessionId ?? null,
        niveau: ctx.niveau ?? null,
        creditsDebites: ctx.creditsDebites ?? null,
        dureeMs: Math.max(0, Math.round(rec.durationMs)),
        statut: rec.status,
        erreur: rec.error ? rec.error.slice(0, 300) : null,
      },
    });
  } catch (e) {
    // Contrainte : une panne de journalisation ne casse aucun parcours utilisateur.
    console.error("[llm-log] échec de journalisation (ignoré) :", e);
  }
}
