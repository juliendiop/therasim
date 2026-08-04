// Segmentation des comptes pour les campagnes CRM et les stats d'acquisition.
// Module PUR (pas de `server-only`, pas de Prisma) : testable sans base, et
// importable aussi bien depuis l'app que depuis les tests. L'appelant est
// responsable de rassembler les signaux (requêtes Prisma) et de les passer
// à `computeSegment` — voir `src/lib/user-stats.ts` pour la collecte réelle.
import { z } from "zod";

export const SEGMENTS = [
  "jamais_actif",
  "actif_gratuit",
  "essai_beta",
  "abonne_actif",
  "abonne_dormant",
  "beta_non_converti",
  "resilie",
] as const;

export type Segment = (typeof SEGMENTS)[number];

export const segmentSchema = z.enum(SEGMENTS);

export const SEGMENT_LABEL: Record<Segment, string> = {
  jamais_actif: "Jamais actif",
  actif_gratuit: "Actif (gratuit)",
  essai_beta: "Essai bêta",
  abonne_actif: "Abonné actif",
  abonne_dormant: "Abonné dormant",
  beta_non_converti: "Bêta non converti",
  resilie: "Résilié",
};

/** Seuil de dormance (jours). Clé/défaut en config — même mécanisme que BETA_CONFIG
 *  (voir `src/lib/segment-config.ts` pour la lecture à l'exécution via app_config).
 *  Valeur de départ alignée sur `JOURS_OUBLI` (src/lib/mastery.ts) mais NON couplée :
 *  un changement de l'un ne doit jamais faire dériver l'autre en silence. */
export const SEGMENT_CONFIG = {
  dormantAfterDays: { key: "segments.dormant.days", default: 21 },
} as const;

export type SegmentInput = {
  /** Date d'inscription du compte. */
  createdAt: Date;
  /** Au moins un entretien N3 mené à son terme (SimSession kind='simulation' ET
   *  statut='terminee'). C'est la définition de l'« activation » pour la segmentation. */
  hasCompletedActivation: boolean;
  /** A déjà réclamé une invitation bêta (BetaInvite.status === 'CLAIMED' pour ce compte). */
  isBetaOrigin: boolean;
  /** Statut Stripe courant (`UserSubscription.status`), ou `null` si le compte n'a
   *  jamais eu de ligne d'abonnement. Une seule ligne par utilisateur (upsert par
   *  userId) : ce champ reflète toujours l'état COURANT, jamais un historique. */
  subscriptionStatus: string | null;
  /** Dernière activité produit connue (drill/mini-scène/simulation), toutes sources
   *  confondues. `null` si aucune activité n'a jamais été enregistrée. */
  lastActivityAt: Date | null;
  /** Horloge injectée (testabilité) — par défaut `new Date()`. */
  now?: Date;
  /** Seuil de dormance en jours (config, voir SEGMENT_CONFIG). */
  dormantAfterDays: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Calcule le segment d'un compte. Chaîne if/return stricte, du plus spécifique
 * (états temporaires ou liés à la bêta) au plus général (catch-all) : un seul
 * `return` s'exécute jamais deux segments pour un même compte, PAR CONSTRUCTION
 * (voir test/segments.test.ts pour la preuve d'exclusivité).
 *
 * Ordre et justification :
 *  1. essai_beta          — état temporaire le plus spécifique (Stripe `trialing`,
 *                           qui dans cette base n'existe QUE via la réclamation bêta,
 *                           `src/lib/beta.ts` étant seul à poser `trial_period_days`).
 *  2. abonne_actif/dormant — abonnement payant en cours (`active`), qu'il soit ou non
 *                           d'origine bêta : un bêta-testeur qui convertit doit tomber
 *                           ici, jamais dans beta_non_converti (vérifié par test).
 *  3. beta_non_converti   — plus aucun abonnement entitled, mais origine bêta : le
 *                           « hors cas bêta » de `resilie` est donc déjà garanti ici.
 *  4. resilie             — a eu un abonnement (ligne UserSubscription non vide),
 *                           n'est plus entitled, jamais bêta.
 *  5. actif_gratuit / jamais_actif — jamais eu d'abonnement ; distingués par
 *                           l'activation (entretien N3 terminé) ou son absence.
 */
export function computeSegment(input: SegmentInput): Segment {
  const now = input.now ?? new Date();

  if (input.subscriptionStatus === "trialing") return "essai_beta";

  if (input.subscriptionStatus === "active") {
    const lastActivity = input.lastActivityAt ?? input.createdAt;
    const daysSinceActivity = (now.getTime() - lastActivity.getTime()) / DAY_MS;
    return daysSinceActivity <= input.dormantAfterDays ? "abonne_actif" : "abonne_dormant";
  }

  if (input.isBetaOrigin) return "beta_non_converti";

  if (input.subscriptionStatus !== null) return "resilie";

  return input.hasCompletedActivation ? "actif_gratuit" : "jamais_actif";
}
