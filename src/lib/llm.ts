// Point d'entrée unique des appels LLM : dispatch par usage vers le fournisseur
// configuré dans /admin/modeles (Mistral ou Claude/Anthropic).
// `temperature` ne s'applique qu'à Mistral (paramètre retiré des modèles Claude
// récents) ; le ton des prompts fait le travail côté Claude.
//
// PASSAGE OBLIGÉ DE LA JOURNALISATION DES COÛTS : aucun appel LLM du dépôt n'échappe à
// ces deux fonctions. Chaque appel écrit une ligne LlmCall (usage, fournisseur, modèle,
// tokens, coût figé, contexte). L'écriture est en aval de la réponse et ne fait jamais
// échouer la requête (logLlmCall ne lève pas). Les signatures publiques ci-dessous ne
// changent pas : aucun des appelants n'est impacté.

import "server-only";
import { getLlm, type LlmUsage } from "./config";
import { mistralChat, mistralChatStream, type ChatMsg } from "./mistral";
import { anthropicChat, anthropicChatStream } from "./anthropic";
import { currentLlmContext } from "./llm-context";
import { logLlmCall } from "./llm-log";
import { estimateTokens } from "./llm-pricing";
import { emptyUsage } from "./llm-usage";

export type { ChatMsg };

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export async function llmChat(
  usage: LlmUsage,
  messages: ChatMsg[],
  opts: { temperature?: number; json?: boolean; maxTokens?: number } = {},
): Promise<string> {
  const started = Date.now();
  const { provider, model } = await getLlm(usage);
  try {
    const { text, usage: tokens } =
      provider === "anthropic"
        ? await anthropicChat(messages, { model, json: opts.json, maxTokens: opts.maxTokens })
        : await mistralChat(messages, { model, temperature: opts.temperature, json: opts.json });
    // Contexte ambiant (propagé par AsyncLocalStorage à travers les awaits).
    await logLlmCall({ usage, provider, model, tokens, status: "ok", durationMs: Date.now() - started });
    return text;
  } catch (e) {
    // Une erreur APRÈS consommation de tokens a coûté de l'argent : on écrit quand même.
    await logLlmCall({
      usage,
      provider,
      model,
      tokens: emptyUsage(),
      status: "error",
      durationMs: Date.now() - started,
      error: errMsg(e),
    });
    throw e;
  }
}

export async function llmChatStream(
  usage: LlmUsage,
  messages: ChatMsg[],
  opts: { temperature?: number; maxTokens?: number } = {},
): Promise<AsyncGenerator<string, void, unknown>> {
  const started = Date.now();
  // Le flux est consommé PLUS TARD, hors de la portée AsyncLocalStorage de l'appelant :
  // on capte le contexte MAINTENANT et on le passe à la journalisation de fin de flux.
  const ctx = { ...currentLlmContext() };
  const { provider, model } = await getLlm(usage);

  let inner: {
    stream: AsyncGenerator<string, void, unknown>;
    usage: () => ReturnType<typeof emptyUsage> | null;
  };
  try {
    inner =
      provider === "anthropic"
        ? await anthropicChatStream(messages, { model, maxTokens: opts.maxTokens })
        : await mistralChatStream(messages, { model, temperature: opts.temperature });
  } catch (e) {
    await logLlmCall(
      {
        usage,
        provider,
        model,
        tokens: emptyUsage(),
        status: "error",
        durationMs: Date.now() - started,
        error: errMsg(e),
      },
      ctx,
    );
    throw e;
  }

  const promptText = messages.map((m) => m.content).join("\n");

  async function* wrapped(): AsyncGenerator<string, void, unknown> {
    let full = "";
    try {
      for await (const chunk of inner.stream) {
        full += chunk;
        yield chunk;
      }
    } catch (e) {
      const captured = inner.usage();
      await logLlmCall(
        {
          usage,
          provider,
          model,
          tokens: captured ?? estimateTokens(promptText, full),
          status: "error",
          durationMs: Date.now() - started,
          error: errMsg(e),
        },
        ctx,
      );
      throw e;
    }
    // Flux terminé : usage réel si l'API l'a renvoyé, sinon estimation marquée `estimated`
    // (une ligne approximative vaut mieux qu'un trou qui fausse les agrégats).
    const captured = inner.usage();
    await logLlmCall(
      {
        usage,
        provider,
        model,
        tokens: captured ?? estimateTokens(promptText, full),
        status: captured ? "ok" : "estimated",
        durationMs: Date.now() - started,
      },
      ctx,
    );
  }

  return wrapped();
}

/** Au moins un fournisseur IA est-il utilisable ? (présence d'une clé) */
export function isLlmConfigured(): boolean {
  return Boolean(process.env.MISTRAL_API_KEY || process.env.ANTHROPIC_API_KEY);
}
