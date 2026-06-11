// Petit client Mistral partagé (chat). Utilisé par le simulateur (patient + débrief).
import { EvaluatorNotConfiguredError } from "./evaluator";

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
