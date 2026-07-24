// Constantes PURES du bilan J+21 et des témoignages — sans `server-only`, pour être
// importables aussi bien côté serveur que par les formulaires client. La logique
// serveur (stockage, lecture, publication) vit dans beta-bilan.ts.

export const BILAN_ANSWER_MAX = 4000;

/** Les 4 questions ouvertes du bilan, dans l'ordre (q1..q4). */
export const BILAN_QUESTIONS = [
  "Qu'est-ce que MELETA vous a réellement apporté ?",
  "Dans quelle situation l'application vous a-t-elle paru la plus utile ?",
  "Qu'est-ce qui reste peu crédible, frustrant ou inutile ?",
  "Vous sentez-vous plus à l'aise qu'avant sur certaines compétences ?",
] as const;

/** Seuil « promoteur » : une note ≥ 8 déclenche la relance témoignage. */
export const NPS_PROMOTER_MIN = 8;

/** Vrai si la note NPS correspond à un promoteur (8-10). */
export function isPromoterNps(nps: number): boolean {
  return Number.isFinite(nps) && nps >= NPS_PROMOTER_MIN && nps <= 10;
}

// --- Témoignage --------------------------------------------------------------

export const TESTIMONIAL_TEXT_MAX = 600;

/** Les trois amorces à compléter. */
export const TESTIMONIAL_PROMPTS = [
  "Avant MELETA, je…",
  "En utilisant MELETA, j'ai…",
  "Aujourd'hui, je…",
] as const;

export const TESTIMONIAL_DISPLAY_MODES = [
  { value: "name_profession", label: "Prénom et profession" },
  { value: "first_name", label: "Prénom uniquement" },
  { value: "anonymous", label: "Totalement anonyme" },
] as const;

export type TestimonialDisplayMode = (typeof TESTIMONIAL_DISPLAY_MODES)[number]["value"];

export function isTestimonialDisplayMode(v: string): v is TestimonialDisplayMode {
  return TESTIMONIAL_DISPLAY_MODES.some((m) => m.value === v);
}

/**
 * Nom d'affichage public d'un témoignage selon le mode choisi par l'auteur.
 * Ne révèle jamais plus que ce que l'auteur a autorisé.
 */
export function testimonialAttribution(t: {
  displayMode: string;
  firstName: string | null;
  profession: string | null;
}): string {
  if (t.displayMode === "anonymous") return "Témoignage anonyme";
  const name = t.firstName?.trim() || "Un(e) praticien(ne)";
  if (t.displayMode === "name_profession" && t.profession?.trim()) {
    return `${name}, ${t.profession.trim()}`;
  }
  return name;
}
