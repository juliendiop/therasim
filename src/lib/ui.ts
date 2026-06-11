// Tokens visuels partagés (couleurs par palier de maîtrise).
import type { Palier } from "./mastery";

export const PALIER_COLOR: Record<Palier, string> = {
  non_pratique: "#cbd5e1", // gris : non couvert, pas une faiblesse
  faible: "#ef4444", // rouge
  emergent: "#f59e0b", // orange
  solide: "#3b82f6", // bleu
  maitrise: "#22c55e", // vert
};

export const TYPE_LABEL: Record<string, string> = {
  approche: "Approche",
  transversale: "Compétence transversale",
  situation: "Situation",
};

export function pct(x: number | null): string {
  if (x === null || x === undefined) return "—";
  return `${Math.round(x * 100)}%`;
}
