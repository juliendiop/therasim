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
  if (x === null || x === undefined || !Number.isFinite(x)) return "—";
  return `${Math.round(x * 100)}%`;
}

export const KIND_LABEL: Record<string, string> = {
  simulation: "Entretien simulé",
  miniscene: "Mini-scène guidée",
};

/**
 * Libellé des domaines inclus dans un forfait. Depuis la refonte « tout inclus »,
 * chaque niveau — gratuit compris — donne accès à l'intégralité des domaines ;
 * la seule variable tarifaire est le volume de crédits. Le paramètre `quota` est
 * conservé pour compatibilité d'appel mais n'a plus d'effet (colonne neutralisée).
 */
export function planQuotaLabel(_quota?: number | null): string {
  return "tous les domaines inclus";
}

/** Date lisible en Europe/Paris (le serveur tourne en UTC). */
export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeZone: "Europe/Paris",
  }).format(new Date(d));
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(d));
}
