// Tokens visuels partagés (couleurs par palier de maîtrise).
import type { Palier } from "./mastery";

// Échelle de maîtrise signature MELETA (terracotta → vert sapin).
export const PALIER_COLOR: Record<Palier, string> = {
  non_pratique: "#d6cfbc", // filet neutre : non couvert, pas une faiblesse
  faible: "#c26f5f", // terracotta
  emergent: "#d29a4a", // ambre
  solide: "#3e8e86", // teal solide
  maitrise: "#1e6b57", // vert sapin
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
