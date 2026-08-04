// Contexte d'un appel LLM, propagé de façon AMBIANTE (AsyncLocalStorage) pour que le
// passage obligé (src/lib/llm.ts) puisse journaliser userId/tenant/séance/niveau SANS
// changer la signature publique de llmChat/llmChatStream ni celle des onze appelants.
//
// Les frontières (routes/actions/modules métier) enveloppent leur travail avec
// `withLlmContext(...)` ; llm.ts lit `currentLlmContext()` au moment de l'appel.
// Hors d'un `withLlmContext`, le contexte est vide (tous champs nuls) : la ligne est
// tout de même écrite (usage, fournisseur, modèle, tokens, coût), sans attribution.

import { AsyncLocalStorage } from "node:async_hooks";
import type { LlmLevel } from "./llm-usage";

export type LlmContext = {
  userId?: string | null;
  tenantId?: string | null;
  frameworkId?: string | null;
  simSessionId?: string | null;
  niveau?: LlmLevel | null;
  creditsDebites?: number | null;
};

const als = new AsyncLocalStorage<LlmContext>();

/** Exécute `fn` avec un contexte LLM, FUSIONNÉ avec le contexte courant (imbrication sûre). */
export function withLlmContext<T>(ctx: LlmContext, fn: () => T): T {
  return als.run({ ...als.getStore(), ...ctx }, fn);
}

/** Instantané du contexte courant (jamais `undefined`). */
export function currentLlmContext(): LlmContext {
  return als.getStore() ?? {};
}
