// Représentations d'un drill : interne (avec corrigés) vs publique (sans corrigés).

export type DrillOption = {
  text: string;
  is_best: boolean;
  score: number; // 0..1
  feedback: string;
};

export type DrillRow = {
  id: string;
  frameworkId: string;
  competencyId: string;
  scenarioContext: string | null;
  difficulty: number;
  mode: string;
  rappelTheorique: string;
  stimulus: string;
  options: unknown;
  patientReactionSiBon: string | null;
  modeleReponse: string;
};

export type PublicDrill = {
  id: string;
  framework_id: string;
  competency_id: string;
  difficulty: number;
  mode: string;
  rappel_theorique: string;
  stimulus: string;
  // En reconnaissance : uniquement le libellé des options, jamais la bonne réponse.
  options: { text: string }[] | null;
};

export function parseOptions(raw: unknown): DrillOption[] {
  if (!Array.isArray(raw)) return [];
  return raw as DrillOption[];
}

/** Vue exposée au front avant réponse : aucune fuite du corrigé. */
export function publicDrill(d: DrillRow): PublicDrill {
  const isReco = d.mode === "reconnaissance";
  return {
    id: d.id,
    framework_id: d.frameworkId,
    competency_id: d.competencyId,
    difficulty: d.difficulty,
    mode: d.mode,
    rappel_theorique: d.rappelTheorique,
    stimulus: d.stimulus,
    options: isReco ? parseOptions(d.options).map((o) => ({ text: o.text })) : null,
  };
}
