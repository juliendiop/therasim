// Point d'entrée unique des appels LLM : dispatch par usage vers le fournisseur
// configuré dans /admin/modeles (Mistral ou Claude/Anthropic).
// `temperature` ne s'applique qu'à Mistral (paramètre retiré des modèles Claude
// récents) ; le ton des prompts fait le travail côté Claude.

import "server-only";
import { getLlm, type LlmUsage } from "./config";
import { mistralChat, mistralChatStream, type ChatMsg } from "./mistral";
import { anthropicChat, anthropicChatStream } from "./anthropic";

export type { ChatMsg };

export async function llmChat(
  usage: LlmUsage,
  messages: ChatMsg[],
  opts: { temperature?: number; json?: boolean; maxTokens?: number } = {},
): Promise<string> {
  const { provider, model } = await getLlm(usage);
  if (provider === "anthropic") {
    return anthropicChat(messages, {
      model,
      json: opts.json,
      maxTokens: opts.maxTokens,
    });
  }
  return mistralChat(messages, {
    model,
    temperature: opts.temperature,
    json: opts.json,
  });
}

export async function llmChatStream(
  usage: LlmUsage,
  messages: ChatMsg[],
  opts: { temperature?: number; maxTokens?: number } = {},
): Promise<AsyncGenerator<string, void, unknown>> {
  const { provider, model } = await getLlm(usage);
  if (provider === "anthropic") {
    return anthropicChatStream(messages, { model, maxTokens: opts.maxTokens });
  }
  return mistralChatStream(messages, { model, temperature: opts.temperature });
}

/** Au moins un fournisseur IA est-il utilisable ? (présence d'une clé) */
export function isLlmConfigured(): boolean {
  return Boolean(process.env.MISTRAL_API_KEY || process.env.ANTHROPIC_API_KEY);
}
