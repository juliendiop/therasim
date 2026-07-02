// Petit client Mistral partagé (chat). Consommé via src/lib/llm.ts (dispatch fournisseur).
import { EvaluatorNotConfiguredError } from "./llm-errors";

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export async function mistralChat(
  messages: ChatMsg[],
  opts: { temperature?: number; json?: boolean; model?: string } = {},
): Promise<string> {
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
  return data?.choices?.[0]?.message?.content ?? "";
}

/**
 * Variante en flux (SSE) : renvoie un générateur de fragments de texte.
 * La requête est ouverte AVANT de rendre le générateur : les erreurs de
 * configuration (clé absente, 4xx) remontent donc en exception classique.
 */
export async function mistralChatStream(
  messages: ChatMsg[],
  opts: { temperature?: number; model?: string } = {},
): Promise<AsyncGenerator<string, void, unknown>> {
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
      messages,
    }),
  });

  if (!res.ok) throw new Error(`Mistral API erreur ${res.status}: ${await res.text()}`);
  if (!res.body) throw new Error("Mistral API : réponse sans corps");
  const reader = res.body.getReader();

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
          try {
            const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta) yield delta;
          } catch {
            // Ligne SSE illisible : ignorée (le flux continue).
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
  return gen();
}
