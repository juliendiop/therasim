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
  simulation: "Séance simulée",
  miniscene: "Mini-scène guidée",
};

/**
 * Libellé des spécialités incluses dans un forfait. Le socle est TOUJOURS inclus
 * (hors quota) ; le quota ne porte que sur les spécialités. `null` = toutes.
 */
export function planQuotaLabel(quota?: number | null): string {
  if (quota == null) return "Socle + toutes les spécialités";
  return `Socle + ${quota} spécialité${quota > 1 ? "s" : ""} au choix`;
}

/**
 * Libellé de l'allocation mensuelle de crédits. `null` = « sans compter » : on
 * n'affiche JAMAIS de nombre (ni ne laisse entendre une limite).
 */
export function monthlyCreditsLabel(n: number | null): string {
  return n == null
    ? "Mises en situation sans compter"
    : `${n} crédits de mise en situation par mois`;
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
