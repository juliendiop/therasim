// Génération de brouillons de cartes (drills) par IA — brique B de la phase plateforme.
// Réutilise l'API Mistral. Produit un BROUILLON à relire/valider (jamais publié d'office).

import { EvaluatorNotConfiguredError } from "./evaluator";
import { getModel } from "./config";

export type DrillDraft = {
  rappel_theorique: string;
  stimulus: string;
  modele_reponse: string;
  patient_reaction_si_bon: string | null;
  options: { text: string; is_best: boolean; score: number; feedback: string }[] | null;
};

type GenerateInput = {
  frameworkNom: string;
  competenceNom: string;
  ancrage1?: string | null;
  ancrage3?: string | null;
  ancrage5?: string | null;
  mode: "reconnaissance" | "production";
  difficulty: number;
  scenarioContexte?: string | null;
};

export async function generateDrillDraft(input: GenerateInput): Promise<DrillDraft> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new EvaluatorNotConfiguredError();
  const model = await getModel("generation");

  const isReco = input.mode === "reconnaissance";
  const schema = isReco
    ? `{"rappel_theorique":str,"stimulus":str,"modele_reponse":str,"patient_reaction_si_bon":str,"options":[{"text":str,"is_best":bool,"score":number 0..1,"feedback":str}]}`
    : `{"rappel_theorique":str,"stimulus":str,"modele_reponse":str,"patient_reaction_si_bon":str,"options":null}`;

  const system = [
    "Tu es un concepteur pédagogique clinique. Tu rédiges UNE carte d'entraînement (drill)",
    `pour la compétence donnée, dans l'approche « ${input.frameworkNom} ».`,
    isReco
      ? "Mode reconnaissance : propose EXACTEMENT 3 options ; une seule is_best=true (score 1) ; les autres avec un score entre 0 et 0.6 et un feedback expliquant pourquoi."
      : "Mode production (réponse libre) : pas d'options (options=null).",
    "rappel_theorique : 2 à 3 phrases. stimulus : une réplique réaliste du patient.",
    "modele_reponse : une réponse forte. patient_reaction_si_bon : ce que le patient répond à une bonne réponse.",
    "Cas réaliste mais FICTIF. Français. Réponds STRICTEMENT en JSON : " + schema,
  ].join(" ");

  const user = [
    `Compétence : ${input.competenceNom}`,
    input.ancrage1 ? `Ancrage faible (1) : ${input.ancrage1}` : "",
    input.ancrage3 ? `Ancrage moyen (3) : ${input.ancrage3}` : "",
    input.ancrage5 ? `Ancrage excellent (5) : ${input.ancrage5}` : "",
    `Difficulté visée : ${input.difficulty}/3`,
    input.scenarioContexte ? `Contexte du cas : ${input.scenarioContexte}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Mistral API erreur ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? "{}");

  return {
    rappel_theorique: String(parsed.rappel_theorique ?? ""),
    stimulus: String(parsed.stimulus ?? ""),
    modele_reponse: String(parsed.modele_reponse ?? ""),
    patient_reaction_si_bon: parsed.patient_reaction_si_bon
      ? String(parsed.patient_reaction_si_bon)
      : null,
    options: isReco && Array.isArray(parsed.options) ? parsed.options : null,
  };
}
