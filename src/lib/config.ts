// Configuration applicative (clé/valeur en base). Sert au choix du modèle LLM par usage.
import { prisma } from "./prisma";

export type LlmUsage = "patient" | "evaluateur" | "generation";

export const LLM_USAGES: { key: LlmUsage; label: string; desc: string }[] = [
  { key: "patient", label: "Patient (N2/N3)", desc: "Incarne le patient dans les mini-scènes et simulations." },
  { key: "evaluateur", label: "Évaluateur & débrief", desc: "Note les réponses (drills production), débriefe, donne les indices." },
  { key: "generation", label: "Génération de cartes", desc: "Génère les brouillons de drills par IA dans l'admin de contenu." },
];

// Modèles Mistral proposés dans l'admin (liste indicative, champ libre possible).
export const MODELES_SUGGESTS = [
  "mistral-small-latest",
  "mistral-medium-latest",
  "mistral-large-latest",
  "open-mistral-nemo",
];

function defaultModel(): string {
  return process.env.MISTRAL_MODEL || "mistral-small-latest";
}

export async function getConfig(key: string): Promise<string | null> {
  const row = await prisma.appConfig.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setConfig(key: string, value: string): Promise<void> {
  await prisma.appConfig.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

/** Modèle LLM à utiliser pour un usage donné (config admin, sinon défaut .env). */
export async function getModel(usage: LlmUsage): Promise<string> {
  const v = await getConfig(`model.${usage}`);
  return v && v.trim() ? v.trim() : defaultModel();
}

/** Lit les modèles configurés pour tous les usages (pour l'admin). */
export async function getAllModels(): Promise<Record<LlmUsage, string>> {
  const rows = await prisma.appConfig.findMany({
    where: { key: { in: LLM_USAGES.map((u) => `model.${u.key}`) } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const out = {} as Record<LlmUsage, string>;
  for (const u of LLM_USAGES) out[u.key] = map.get(`model.${u.key}`) ?? defaultModel();
  return out;
}
