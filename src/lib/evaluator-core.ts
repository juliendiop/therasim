// Cœur PUR de l'évaluateur mono-compétence (mode "production") — spec §4.3.
// Aucune dépendance serveur (pas de `server-only`, pas de LLM, pas de DB) : ce
// module contient le prompt, la construction de l'entrée et le parsing de la
// sortie, pour qu'ils soient testables hors de Next (cf. scripts/calibrate-evaluator.ts).
// L'appel LLM effectif vit dans evaluator.ts (qui importe ce cœur + llm.ts).

export type EvaluationResult = {
  score: number; // note 1..5
  justification: string;
  evidence: string;
  suggested_better_response: string;
  non_evalue: boolean;
};

export type EvaluateInput = {
  competenceNom: string;
  ancrage1?: string | null;
  ancrage3?: string | null;
  ancrage5?: string | null;
  stimulus: string;
  modeleReponse: string;
  reponseApprenant: string;
};

// Rubrique et méthode communes à toutes les compétences. Le « comment noter »
// est ici ; le « quoi noter » (ancrages de la compétence) est passé en contexte.
//
// Calibration (22 juillet) : rubrique 1..5 explicite (2 et 4 définis par
// interpolation), raisonnement AVANT la note, un exemple travaillé pour ancrer
// l'échelle, critère non_evalue resserré. Qualité mesurée par
// scripts/calibrate-evaluator.ts.
export const EVALUATOR_SYSTEM_PROMPT = [
  "Tu es un superviseur clinique rigoureux. Tu évalues UNE seule compétence à la fois,",
  "de façon cohérente et reproductible : la même réponse doit toujours recevoir la même note.",
  "",
  "MÉTHODE (dans cet ordre) :",
  "1. Compare la réponse de l'apprenant aux ancrages fournis. Les ancrages 1 (faible),",
  "   3 (moyen) et 5 (excellent) sont les repères ; la réponse modèle illustre un niveau 5.",
  "2. Repère UN court extrait de la réponse de l'apprenant qui justifie ton évaluation (evidence).",
  "3. Rédige une justification brève et factuelle qui situe la réponse par rapport aux ancrages.",
  "4. Attribue SEULEMENT ALORS la note, sur l'échelle suivante :",
  "   - 1 : correspond à l'ancrage faible (contre-productif ou à côté).",
  "   - 2 : entre faible et moyen (amorce maladroite, gros manque).",
  "   - 3 : correspond à l'ancrage moyen (acceptable mais incomplet).",
  "   - 4 : entre moyen et excellent (bon, un cran sous le modèle).",
  "   - 5 : correspond à l'ancrage excellent (au niveau de la réponse modèle).",
  "   Sois strict sur le bas de l'échelle, mais JUSTE en haut : si la réponse atteint la qualité",
  "   de la réponse modèle — même formulée autrement — attribue 5 sans hésiter (ne réserve pas",
  "   le 5 à une réponse « parfaite » : le modèle EST le niveau 5). Ne descends à 4 que s'il",
  "   manque un élément clair par rapport à l'ancrage excellent.",
  "",
  "non_evalue=true UNIQUEMENT si la réponse ne permet pas de juger la compétence :",
  "réponse vide, hors-sujet, méta-commentaire (« je ne sais pas », « c'est difficile »),",
  "ou charabia. Une VRAIE tentative clinique, même maladroite, n'est jamais non_evalue :",
  "elle reçoit une note basse (1 ou 2).",
  "",
  "EXEMPLE (compétence « Reflets » — ancrage 1 : répète mot à mot ; ancrage 5 : reflet",
  "complexe qui ajoute du sens ou nomme l'émotion sous-jacente) :",
  '- Réponse « Vous aimez bien boire le soir. » → {"evidence":"aimez bien boire le soir",',
  '  "justification":"Paraphrase de surface sans ajouter de sens : proche de l\'ancrage faible.",',
  '  "non_evalue":false,"suggested_better_response":"Ce moment, c\'est votre soupape pour',
  ' relâcher la pression.","score":2}',
  '- Réponse « Ce moment, c\'est votre façon de relâcher la pression de la journée. » →',
  '  {"evidence":"votre façon de relâcher la pression","justification":"Reflet complexe qui',
  ' nomme la fonction du comportement : atteint l\'ancrage excellent.","non_evalue":false,',
  '  "suggested_better_response":"","score":5}',
  "",
  "Réponds STRICTEMENT en JSON, dans cet ordre de champs :",
  '{"evidence":str,"justification":str,"non_evalue":bool,"suggested_better_response":str,"score":int}.',
  "score est un entier de 1 à 5. suggested_better_response peut être vide si la réponse est déjà excellente.",
].join("\n");

/** Construit le message utilisateur (contexte de la compétence + réponse à noter). */
export function buildEvaluationUserPrompt(input: EvaluateInput): string {
  return [
    `Compétence évaluée : ${input.competenceNom}`,
    input.ancrage1 ? `Ancrage niveau 1 (faible) : ${input.ancrage1}` : "",
    input.ancrage3 ? `Ancrage niveau 3 (moyen) : ${input.ancrage3}` : "",
    input.ancrage5 ? `Ancrage niveau 5 (excellent) : ${input.ancrage5}` : "",
    "",
    `Réplique du patient (stimulus) : ${input.stimulus}`,
    `Réponse modèle attendue (niveau 5) : ${input.modeleReponse}`,
    `Réponse de l'apprenant à évaluer : ${input.reponseApprenant}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Parse la sortie JSON du LLM en résultat sûr (note bornée, champs par défaut). */
export function parseEvaluation(raw: string, fallbackEvidence = ""): EvaluationResult {
  const parsed = JSON.parse(raw) as Partial<EvaluationResult>;
  return {
    score: clampNote(Number(parsed.score ?? 1)),
    justification: String(parsed.justification ?? ""),
    evidence: String(parsed.evidence ?? fallbackEvidence),
    suggested_better_response: String(parsed.suggested_better_response ?? ""),
    non_evalue: Boolean(parsed.non_evalue ?? false),
  };
}

export function clampNote(n: number): number {
  if (Number.isNaN(n)) return 1;
  return Math.max(1, Math.min(5, Math.round(n)));
}
