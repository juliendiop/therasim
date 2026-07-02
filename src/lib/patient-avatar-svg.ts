// Portrait illustré déterministe d'un patient (cas fictif) — jamais de vraie photo.
// Généré côté serveur uniquement (DiceBear, style "lorelei") à partir du titre du
// scénario : même seed -> même visage, à chaque session, pour chaque apprenant.
import "server-only";
import { createAvatar } from "@dicebear/core";
import * as lorelei from "@dicebear/lorelei";

// Palette de fond alignée sur l'identité MELETA (hexa nu, sans '#').
const BG_PALETTE = [
  "0e5a54",
  "a8772a",
  "3e8e86",
  "c26f5f",
  "6b5b95",
  "4a6fa5",
  "7a8f5a",
  "b5651d",
];

// Cache mémoire process : le rendu est pur (même seed -> même SVG), inutile de
// regénérer à chaque requête — une quinzaine de scénarios distincts en tout.
const cache = new Map<string, string>();

export function renderPatientAvatarSvg(seed: string): string {
  const key = seed.trim() || "patient";
  const cached = cache.get(key);
  if (cached) return cached;
  const avatar = createAvatar(lorelei, {
    seed: key,
    backgroundColor: BG_PALETTE,
    backgroundType: ["solid"],
  });
  const svg = avatar.toString();
  cache.set(key, svg);
  return svg;
}
