// Client Claude (Anthropic) — pendant de mistral.ts, via le SDK officiel.
// Particularités gérées ici :
// - `system` est un paramètre séparé (pas un message) ;
// - le premier message doit être `user` (on préfixe si l'historique commence
//   par une réplique du patient) ;
// - pas de `temperature` (paramètre retiré des modèles Claude récents — le ton
//   se pilote par le prompt) ; thinking désactivé (latence maîtrisée) ;
// - pas de mode JSON natif : les prompts exigent déjà du JSON strict, on
//   extrait l'objet de la réponse (clôtures de code éventuelles retirées).

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { EvaluatorNotConfiguredError } from "./llm-errors";
import type { ChatMsg } from "./mistral";

function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new EvaluatorNotConfiguredError(
      "ANTHROPIC_API_KEY non configurée : le fournisseur Claude est indisponible.",
    );
  }
  return new Anthropic({ apiKey });
}

function splitMessages(messages: ChatMsg[]): {
  system: string;
  turns: { role: "user" | "assistant"; content: string }[];
} {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const turns = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  // L'API exige que la conversation commence par un tour `user`.
  if (turns.length === 0 || turns[0].role !== "user") {
    turns.unshift({ role: "user", content: "(L'entretien commence.)" });
  }
  return { system, turns };
}

/** Isole l'objet JSON d'une réponse texte (retire ```json … ``` et le hors-sujet). */
export function extractJson(text: string): string {
  const t = text.trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  return start >= 0 && end > start ? t.slice(start, end + 1) : t;
}

export async function anthropicChat(
  messages: ChatMsg[],
  opts: { model: string; maxTokens?: number; json?: boolean },
): Promise<string> {
  const { system, turns } = splitMessages(messages);
  const res = await client().messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 4096,
    thinking: { type: "disabled" },
    ...(system ? { system } : {}),
    messages: turns,
  });
  const text = res.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  return opts.json ? extractJson(text) : text;
}

/** Variante en flux : générateur de fragments de texte (même contrat que mistralChatStream). */
export async function anthropicChatStream(
  messages: ChatMsg[],
  opts: { model: string; maxTokens?: number },
): Promise<AsyncGenerator<string, void, unknown>> {
  const { system, turns } = splitMessages(messages);
  const stream = client().messages.stream({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 1024,
    thinking: { type: "disabled" },
    ...(system ? { system } : {}),
    messages: turns,
  });

  async function* gen(): AsyncGenerator<string, void, unknown> {
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      }
    }
  }
  return gen();
}
