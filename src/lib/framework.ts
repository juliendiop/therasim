// Métadonnées commerciales d'un référentiel (pures, sans dépendance serveur).
// Convention du dépôt : String + union TypeScript + Zod, jamais d'enum Prisma natif.
import { z } from "zod";

/** 'socle' = accessible à tout compte (gratuit compris), hors quota de spécialités.
 *  'specialite' = compté dans le quota du forfait. */
export const frameworkNatureSchema = z.enum(["socle", "specialite"]);
export type FrameworkNature = z.infer<typeof frameworkNatureSchema>;

/** Palier requis — réservé à un usage FUTUR, inexploité au lancement. */
export const frameworkTierSchema = z.enum(["standard", "premium"]);
export type FrameworkTier = z.infer<typeof frameworkTierSchema>;

/** Repli prudent sur 'specialite' si la valeur est inconnue (défaut de la colonne). */
export function parseNature(v: unknown): FrameworkNature {
  return frameworkNatureSchema.safeParse(v).data ?? "specialite";
}

/** Repli prudent sur 'standard'. */
export function parseTier(v: unknown): FrameworkTier {
  return frameworkTierSchema.safeParse(v).data ?? "standard";
}

export const NATURE_LABEL: Record<FrameworkNature, string> = {
  socle: "Socle (inclus partout)",
  specialite: "Spécialité",
};
