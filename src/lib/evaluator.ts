// Évaluateur mono-compétence (mode "production") — spec §4.3.
// Même moteur que la simulation, version restreinte : une seule compétence à juger.
// Paramétré par référentiel via les ancrages 1/3/5 de la compétence.
// Fournisseur/modèle : usage « evaluateur » de /admin/modeles (Mistral ou Claude).
// En reconnaissance : AUCUN appel LLM (voir attempt route).

import { llmChat } from "./llm";

// Ré-export historique : routes et actions attrapent cette erreur pour le 503.
export { EvaluatorNotConfiguredError } from "./llm-errors";

export type EvaluationResult = {
  score: number; // note 1..5
  justification: string;
  evidence: string;
  suggested_better_response: string;
  non_evalue: boolean;
};

/** Au moins un fournisseur IA dispose d'une clé (les fonctions IA sont activables). */
export function isEvaluatorConfigured(): boolean {
  return Boolean(process.env.MISTRAL_API_KEY || process.env.ANTHROPIC_API_KEY);
}

type EvaluateInput = {
  competenceNom: string;
  ancrage1?: string | null;
  ancrage3?: string | null;
  ancrage5?: string | null;
  stimulus: string;
  modeleReponse: string;
  reponseApprenant: string;
};

export async function evaluateMonoCompetence(
  input: EvaluateInput,
): Promise<EvaluationResult> {
  const system = [
    "Tu es un superviseur clinique qui évalue UNE seule compétence à la fois.",
    "Tu notes la réponse de l'apprenant sur une échelle de 1 à 5 selon les ancrages fournis.",
    "Tu cites la réponse de l'apprenant comme preuve. Tu restes bref et factuel.",
    "Si la réponse ne permet pas d'évaluer la compétence, mets non_evalue=true.",
    'Réponds STRICTEMENT en JSON : {"score":int,"justification":str,"evidence":str,"suggested_better_response":str,"non_evalue":bool}.',
  ].join(" ");

  const user = [
    `Compétence évaluée : ${input.competenceNom}`,
    input.ancrage1 ? `Ancrage niveau 1 (faible) : ${input.ancrage1}` : "",
    input.ancrage3 ? `Ancrage niveau 3 (moyen) : ${input.ancrage3}` : "",
    input.ancrage5 ? `Ancrage niveau 5 (excellent) : ${input.ancrage5}` : "",
    "",
    `Réplique du patient (stimulus) : ${input.stimulus}`,
    `Réponse modèle attendue : ${input.modeleReponse}`,
    `Réponse de l'apprenant : ${input.reponseApprenant}`,
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await llmChat(
    "evaluateur",
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { temperature: 0.2, json: true, maxTokens: 2048 },
  );
  const parsed = JSON.parse(raw) as Partial<EvaluationResult>;

  return {
    score: clampNote(Number(parsed.score ?? 1)),
    justification: String(parsed.justification ?? ""),
    evidence: String(parsed.evidence ?? input.reponseApprenant),
    suggested_better_response: String(parsed.suggested_better_response ?? ""),
    non_evalue: Boolean(parsed.non_evalue ?? false),
  };
}

function clampNote(n: number): number {
  if (Number.isNaN(n)) return 1;
  return Math.max(1, Math.min(5, Math.round(n)));
}
