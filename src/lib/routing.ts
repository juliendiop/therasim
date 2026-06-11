// Routage adaptatif scopé au référentiel en cours — spec §5.4.
// Calcule, pour chaque compétence d'un référentiel, une priorité de travail,
// puis choisit le drill recommandé (compétence prioritaire + difficulté en zone proximale).

import { couvertureNorm, palier, recence } from "./mastery";

export const POIDS = { w1: 0.45, w2: 0.3, w3: 0.15, w4: 0.1 } as const;

export type EtatCompetence = {
  competencyId: string;
  mastery: number | null;
  attempts: number;
  lastPracticed: Date | null;
};

/** priorite = w1*(1-mastery) + w2*(1-couv_norm) + w3*recence + w4*pertinence (spec §5.4). */
export function prioriteCompetence(e: EtatCompetence, pertinenceScenario = 0): number {
  const m = e.mastery ?? 0; // non pratiqué traité comme 0
  return (
    POIDS.w1 * (1 - m) +
    POIDS.w2 * (1 - couvertureNorm(e.attempts)) +
    POIDS.w3 * recence(e.lastPracticed) +
    POIDS.w4 * pertinenceScenario
  );
}

/** Raison lisible affichée dans le panneau "à travailler en priorité" (spec §5.6). */
export function raisonPriorite(e: EtatCompetence): string {
  if (e.attempts === 0 || e.mastery === null) return "jamais abordée";
  if (e.mastery < 0.4) return "maîtrise faible";
  if (e.attempts >= 3 && e.mastery < 0.6) return "fragile malgré la pratique";
  return "à consolider";
}

/** Difficulté cible : juste au-dessus de la maîtrise courante (zone proximale, spec §5.4). */
export function difficulteCible(mastery: number | null): number {
  const p = palier(mastery);
  if (p === "non_pratique" || p === "faible") return 1;
  if (p === "emergent") return 2;
  return 3; // solide et + (ou bascule N2, hors périmètre session 1)
}

/** Pour un débutant (maîtrise faible / non pratiquée), privilégier la reconnaissance (spec §4.1). */
export function modePrefere(mastery: number | null): "reconnaissance" | "production" {
  const p = palier(mastery);
  return p === "non_pratique" || p === "faible" ? "reconnaissance" : "production";
}

/** Trie les compétences par priorité décroissante. */
export function classerPriorites(etats: EtatCompetence[]): EtatCompetence[] {
  return [...etats].sort((a, b) => prioriteCompetence(b) - prioriteCompetence(a));
}

type DrillCandidat = {
  id: string;
  competencyId: string;
  difficulty: number;
  mode: string;
};

/**
 * Choisit le meilleur drill pour l'état d'une compétence :
 * difficulté la plus proche de la cible, puis mode préféré, sinon le plus proche.
 */
export function choisirDrill(
  e: EtatCompetence,
  candidats: DrillCandidat[],
): DrillCandidat | null {
  if (candidats.length === 0) return null;
  const cible = difficulteCible(e.mastery);
  const mode = modePrefere(e.mastery);
  return [...candidats].sort((a, b) => {
    const da = Math.abs(a.difficulty - cible);
    const db = Math.abs(b.difficulty - cible);
    if (da !== db) return da - db;
    const ma = a.mode === mode ? 0 : 1;
    const mb = b.mode === mode ? 0 : 1;
    return ma - mb;
  })[0];
}
