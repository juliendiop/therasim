// Évaluateur mono-compétence (mode "production") — spec §4.3.
// Même moteur que la simulation, version restreinte : une seule compétence à juger.
// Paramétré par référentiel via les ancrages 1/3/5 de la compétence.
// Fournisseur/modèle : usage « evaluateur » de /admin/modeles (Mistral ou Claude).
// En reconnaissance : AUCUN appel LLM (voir attempt route).
//
// Le prompt, la construction d'entrée et le parsing vivent dans evaluator-core.ts
// (pur, sans dépendance serveur) pour être testables hors Next
// (scripts/calibrate-evaluator.ts). Ici : uniquement l'appel LLM effectif.

import { llmChat } from "./llm";
import {
  EVALUATOR_SYSTEM_PROMPT,
  buildEvaluationUserPrompt,
  parseEvaluation,
  type EvaluateInput,
  type EvaluationResult,
} from "./evaluator-core";

export type { EvaluationResult } from "./evaluator-core";

// Ré-export historique : routes et actions attrapent cette erreur pour le 503.
export { EvaluatorNotConfiguredError } from "./llm-errors";

/** Au moins un fournisseur IA dispose d'une clé (les fonctions IA sont activables). */
export function isEvaluatorConfigured(): boolean {
  return Boolean(process.env.MISTRAL_API_KEY || process.env.ANTHROPIC_API_KEY);
}

export async function evaluateMonoCompetence(
  input: EvaluateInput,
): Promise<EvaluationResult> {
  const raw = await llmChat(
    "evaluateur",
    [
      { role: "system", content: EVALUATOR_SYSTEM_PROMPT },
      { role: "user", content: buildEvaluationUserPrompt(input) },
    ],
    // Température 0 : la note doit être reproductible (une réponse = une note stable).
    { temperature: 0, json: true, maxTokens: 2048 },
  );
  return parseEvaluation(raw, input.reponseApprenant);
}
