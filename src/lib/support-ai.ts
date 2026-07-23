// Assistance IA sur un ticket de support.
//
// ⚠️ Fournisseur : l'usage `support` est VERROUILLÉ sur Mistral (UE) dans
// `getLlm` (cf. EU_ONLY_USAGES dans src/lib/config.ts). Le contenu d'un ticket se
// rapporte à une personne identifiée : il ne sort pas de l'Union européenne.
//
// La sortie n'est JAMAIS persistée : elle est renvoyée à la page d'administration,
// vit dans l'état du composant, et disparaît à la navigation. Seul l'envoi explicite
// de l'administrateur crée un message, à partir du texte tel qu'il l'a laissé.

import "server-only";
import { llmChat } from "./llm";
import { TICKET_TYPE_LABEL, type TicketContext, type TicketType } from "./support-types";

export type SupportAssist = {
  /** Ce que l'IA comprend de la situation et de son impact. */
  analysis: string;
  /** Informations manquantes si le signalement est trop vague. Vide sinon. */
  missingInfo: string[];
  /** Projet de réponse au client, modifiable avant envoi. */
  draftReply: string;
  /** Brief de correction, uniquement si une intervention se justifie. */
  fixBrief: string | null;
};

const SYSTEM = [
  "Tu assistes le fondateur de MELETA (outil d'entraînement à la relation clinique) dans le",
  "traitement d'un ticket de support. Tu ne parles JAMAIS directement au client : tu prépares",
  "un projet que le fondateur relira et modifiera.",
  "",
  "RÈGLES DU PROJET DE RÉPONSE :",
  "- Français, TUTOIEMENT, direct, court (5 lignes maximum).",
  "- Aucune emphase commerciale, aucun superlatif, aucune formule de politesse ampoulée.",
  "- Signé du prénom « Julien », sans autre signature.",
  "- Ne JAMAIS promettre de délai (« bientôt », « dans la prochaine version », une date).",
  "- Ne JAMAIS affirmer qu'une anomalie est corrigée : tu ne peux pas le savoir.",
  "- S'il manque des informations, la réponse se limite à les demander, sans meubler.",
  "",
  "RÈGLES DU BRIEF DE CORRECTION :",
  "- Uniquement si le ticket justifie une intervention technique. Sinon, mets fixBrief à null.",
  "- Décris le symptôme, le contexte relevé, puis des pistes à explorer.",
  "- Présente ces pistes comme des HYPOTHÈSES À VÉRIFIER, jamais comme un diagnostic établi.",
  "- Tu n'as AUCUNE connaissance du code de MELETA : ne nomme aucun fichier, aucune fonction,",
  "  aucune table, aucune variable. Reste au niveau du comportement observable.",
  "",
  "Réponds STRICTEMENT en JSON :",
  '{"analysis":str,"missingInfo":[str],"draftReply":str,"fixBrief":str|null}',
].join("\n");

function contextLines(ctx: TicketContext | null): string {
  if (!ctx) return "Contexte technique : non relevé.";
  const parts = [
    ctx.page ? `page : ${ctx.page}` : null,
    ctx.appVersion ? `version de l'app : ${ctx.appVersion}` : null,
    ctx.userAgent ? `navigateur : ${ctx.userAgent}` : null,
    ctx.plan ? `forfait : ${ctx.plan}` : "forfait : aucun",
    ctx.subscriptionStatus ? `abonnement : ${ctx.subscriptionStatus}` : null,
    ctx.credits !== null ? `crédits : ${ctx.credits}` : null,
  ].filter(Boolean);
  return `Contexte technique relevé automatiquement :\n- ${parts.join("\n- ")}`;
}

/**
 * Une seule sollicitation : analyse + informations manquantes + projet de réponse
 * + brief éventuel. Déclenchée par un clic de l'administrateur, jamais à la création
 * d'un ticket (maîtrise de la dépense).
 */
export async function assistOnTicket(input: {
  type: TicketType;
  subject: string;
  context: TicketContext | null;
  messages: { authorRole: "client" | "admin"; body: string }[];
}): Promise<SupportAssist> {
  const transcript = input.messages
    .map((m) => `[${m.authorRole === "admin" ? "Julien" : "Client"}] ${m.body}`)
    .join("\n\n");

  const user = [
    `Type de demande : ${TICKET_TYPE_LABEL[input.type]}`,
    `Sujet : ${input.subject}`,
    "",
    contextLines(input.context),
    "",
    "Fil de discussion :",
    transcript,
  ].join("\n");

  const raw = await llmChat(
    "support",
    [
      { role: "system", content: SYSTEM },
      { role: "user", content: user },
    ],
    { temperature: 0.3, json: true, maxTokens: 2048 },
  );

  const parsed = JSON.parse(raw) as Partial<SupportAssist>;
  const missing = Array.isArray(parsed.missingInfo)
    ? parsed.missingInfo.filter((m): m is string => typeof m === "string")
    : [];
  const brief = typeof parsed.fixBrief === "string" ? parsed.fixBrief.trim() : "";

  return {
    analysis: String(parsed.analysis ?? "").trim(),
    missingInfo: missing,
    draftReply: String(parsed.draftReply ?? "").trim(),
    fixBrief: brief.length > 0 ? brief : null,
  };
}
