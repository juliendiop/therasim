// Configuration applicative (clé/valeur en base). Sert au choix du modèle LLM par usage.
import { prisma } from "./prisma";

export type LlmUsage = "patient" | "evaluateur" | "generation";

export const LLM_USAGES: { key: LlmUsage; label: string; desc: string }[] = [
  { key: "patient", label: "Patient (N2/N3)", desc: "Incarne le patient dans les mini-scènes et simulations." },
  { key: "evaluateur", label: "Évaluateur & débrief", desc: "Note les réponses (drills production), débriefe, donne les indices." },
  { key: "generation", label: "Génération de cartes", desc: "Génère les brouillons de drills par IA dans l'admin de contenu." },
];

export type LlmProvider = "mistral" | "anthropic";

export const PROVIDERS: { key: LlmProvider; label: string; envKey: string }[] = [
  { key: "mistral", label: "Mistral", envKey: "MISTRAL_API_KEY" },
  { key: "anthropic", label: "Claude (Anthropic)", envKey: "ANTHROPIC_API_KEY" },
];

// Modèles proposés dans l'admin (listes indicatives, champ libre possible).
export const MODELES_SUGGESTS = [
  "mistral-small-latest",
  "mistral-medium-latest",
  "mistral-large-latest",
  "open-mistral-nemo",
];
export const MODELES_SUGGESTS_ANTHROPIC = [
  "claude-opus-4-8",
  "claude-sonnet-5",
  "claude-haiku-4-5",
];
export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-4-8";

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

/**
 * Fournisseur + modèle à utiliser pour un usage donné (config admin, sinon défauts).
 * Garde-fou : un modèle qui ne correspond pas au fournisseur (ex. modèle Mistral
 * resté en base après bascule vers Claude) est remplacé par le défaut du fournisseur.
 */
export async function getLlm(
  usage: LlmUsage,
): Promise<{ provider: LlmProvider; model: string }> {
  const [p, m] = await Promise.all([
    getConfig(`provider.${usage}`),
    getConfig(`model.${usage}`),
  ]);
  const provider: LlmProvider = p === "anthropic" ? "anthropic" : "mistral";
  let model = m?.trim() ?? "";
  const isClaude = model.startsWith("claude");
  if (provider === "anthropic" && (!model || !isClaude)) model = DEFAULT_ANTHROPIC_MODEL;
  if (provider === "mistral" && (!model || isClaude)) model = defaultModel();
  return { provider, model };
}

/** Lit fournisseur + modèle configurés pour tous les usages (pour l'admin). */
export async function getAllLlm(): Promise<
  Record<LlmUsage, { provider: LlmProvider; model: string }>
> {
  const out = {} as Record<LlmUsage, { provider: LlmProvider; model: string }>;
  for (const u of LLM_USAGES) out[u.key] = await getLlm(u.key);
  return out;
}
