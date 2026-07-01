// Calculs de maîtrise / couverture / paliers — spec §5.1 à §5.3.
// Source de vérité unique : un score est toujours normalisé dans [0,1].

export const ALPHA = 0.4; // pondération récence de la moyenne mobile (spec §5.2)

/** Note 1..5 -> score [0,1]. (note - 1) / 4 (spec §5.1). */
export function normalizeNote(note: number): number {
  const n = Number(note);
  if (!Number.isFinite(n)) return 0; // note IA invalide -> score plancher (jamais NaN)
  return clamp((n - 1) / 4, 0, 1);
}

/** Moyenne mobile pondérée par la récence (spec §5.2). */
export function updateMastery(prev: number | null, s: number): number {
  const score = Number.isFinite(s) ? s : 0;
  // prev absent OU corrompu (NaN historique) -> on repart du score courant.
  if (prev === null || prev === undefined || !Number.isFinite(prev)) return score;
  return (1 - ALPHA) * prev + ALPHA * score;
}

export type Palier = "non_pratique" | "faible" | "emergent" | "solide" | "maitrise";

/** Palier de maîtrise (spec §5.3). */
export function palier(mastery: number | null): Palier {
  if (mastery === null || mastery === undefined) return "non_pratique";
  if (mastery < 0.4) return "faible";
  if (mastery < 0.6) return "emergent";
  if (mastery <= 0.8) return "solide";
  return "maitrise";
}

export const PALIER_LABEL: Record<Palier, string> = {
  non_pratique: "non pratiquée",
  faible: "faible",
  emergent: "émergent",
  solide: "solide",
  maitrise: "maîtrisé",
};

export type Couverture = "jamais" | "effleuree" | "pratiquee" | "bien_couverte";

/** Couverture dérivée du nombre d'essais (spec §5.3). */
export function couverture(attempts: number): Couverture {
  if (attempts <= 0) return "jamais";
  if (attempts <= 2) return "effleuree";
  if (attempts <= 5) return "pratiquee";
  return "bien_couverte";
}

export const COUVERTURE_LABEL: Record<Couverture, string> = {
  jamais: "jamais abordée",
  effleuree: "effleurée",
  pratiquee: "pratiquée",
  bien_couverte: "bien couverte",
};

/** Couverture normalisée pour le routage : min(attempts / 6, 1) (spec §5.4). */
export function couvertureNorm(attempts: number): number {
  return Math.min(attempts / 6, 1);
}

export const JOURS_OUBLI = 21; // au-delà : "à réviser" (spec §5.3)

export function joursDepuis(date: Date | null | undefined): number {
  if (!date) return Infinity;
  const ms = Date.now() - new Date(date).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

/** Récence pour le routage : clamp(jours / 30, 0, 1) (spec §5.4). */
export function recence(lastPracticed: Date | null | undefined): number {
  const j = joursDepuis(lastPracticed);
  if (!isFinite(j)) return 1; // jamais pratiqué => récence maximale
  return clamp(j / 30, 0, 1);
}

export function clamp(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, x));
}
