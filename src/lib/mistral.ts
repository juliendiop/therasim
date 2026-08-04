// Petit client Mistral partagé (chat). Consommé via src/lib/llm.ts (dispatch fournisseur).
//
// Les fonctions renvoient désormais { text, usage } / { stream, usage } : llm.ts a besoin
// des compteurs de tokens pour journaliser le coût. Les SIGNATURES PUBLIQUES de llm.ts
// (llmChat/llmChatStream) ne changent pas — la remontée s'arrête au dispatcher.
import { EvaluatorNotConfiguredError } from "./llm-errors";
import type { LlmTokenUsage } from "./llm-usage";

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

/** Mappe l'objet `usage` d'une réponse Mistral vers nos compteurs (pas de cache côté Mistral). */
function mapUsage(u: unknown): LlmTokenUsage {
  const o = (u ?? {}) as { prompt_tokens?: number; completion_tokens?: number };
  return {
    inputTokens: Number(o.prompt_tokens ?? 0),
    outputTokens: Number(o.completion_tokens ?? 0),
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
  };
}

/**
 * Extrait, d'un « chunk » SSE Mistral, le fragment de texte ET l'usage éventuel.
 * Fonction PURE (testée) : c'est elle qui garantit que le CHUNK FINAL porteur de l'usage
 * — `choices` vide/absent — ne renvoie AUCUN texte à relayer à l'utilisateur.
 */
export function parseMistralChunk(payload: string): {
  delta: string;
  usage: LlmTokenUsage | null;
} {
  let obj: { choices?: { delta?: { content?: string } }[]; usage?: unknown };
  try {
    obj = JSON.parse(payload);
  } catch {
    return { delta: "", usage: null };
  }
  const delta = obj?.choices?.[0]?.delta?.content;
  return {
    delta: typeof delta === "string" ? delta : "",
    usage: obj?.usage ? mapUsage(obj.usage) : null,
  };
}

export async function mistralChat(
  messages: ChatMsg[],
  opts: { temperature?: number; json?: boolean; model?: string } = {},
): Promise<{ text: string; usage: LlmTokenUsage }> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new EvaluatorNotConfiguredError();
  const model = opts.model || process.env.MISTRAL_MODEL || "mistral-small-latest";

  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: opts.temperature ?? 0.7,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      messages,
    }),
  });

  if (!res.ok) throw new Error(`Mistral API erreur ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return {
    text: data?.choices?.[0]?.message?.content ?? "",
    usage: mapUsage(data?.usage),
  };
}

/**
 * Variante en flux (SSE) : renvoie un générateur de fragments + un accès à l'usage capté
 * en fin de flux (`usage()` renvoie `null` tant que le flux n'est pas terminé).
 *
 * `stream_options: { include_usage: true }` demande à Mistral un dernier chunk portant
 * l'usage. Ce chunk n'a pas de contenu : `parseMistralChunk` le neutralise (delta vide),
 * donc il n'atterrit jamais dans le texte relayé.
 */
export async function mistralChatStream(
  messages: ChatMsg[],
  opts: { temperature?: number; model?: string } = {},
): Promise<{ stream: AsyncGenerator<string, void, unknown>; usage: () => LlmTokenUsage | null }> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new EvaluatorNotConfiguredError();
  const model = opts.model || process.env.MISTRAL_MODEL || "mistral-small-latest";

  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: opts.temperature ?? 0.7,
      stream: true,
      stream_options: { include_usage: true },
      messages,
    }),
  });

  if (!res.ok) throw new Error(`Mistral API erreur ${res.status}: ${await res.text()}`);
  if (!res.body) throw new Error("Mistral API : réponse sans corps");
  const reader = res.body.getReader();

  let captured: LlmTokenUsage | null = null;

  async function* gen(): AsyncGenerator<string, void, unknown> {
    const decoder = new TextDecoder();
    let buf = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") return;
          const { delta, usage } = parseMistralChunk(payload);
          if (usage) captured = usage; // chunk final : usage seul, aucun texte
          if (delta) yield delta;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
  return { stream: gen(), usage: () => captured };
}
