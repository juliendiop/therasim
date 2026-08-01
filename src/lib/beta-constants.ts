// Réglages de la bêta fermée — module PUR (sans `server-only`), importable aussi bien
// depuis l'app que depuis les scripts (`server-only` ferait échouer l'import tsx).
//
// SOURCE DE VÉRITÉ UNIQUE : ce fichier ne porte plus de valeurs « en dur » lues à
// l'exécution, mais le REGISTRE des réglages (nom de clé app_config + valeur par
// défaut = valeur cible). La lecture à l'exécution passe par la table `app_config`
// (même mécanisme que tous les autres réglages admin) :
//   - côté app : `src/lib/beta-config.ts` (getters async via getConfig) ;
//   - côté scripts : lecture directe d'app_config avec CES mêmes clés/défauts.
// Changer une valeur = `setConfig(clé, valeur)` ; changer un défaut = ici, une fois.

export const BETA_CONFIG = {
  /** `key` du forfait offert (table subscription_plans). */
  planKey: { key: "beta.plan.key", default: "praticien" },
  /** Durée de l'essai offert, en jours. */
  trialDays: { key: "beta.trial.days", default: 30 },
  /** Jours écoulés depuis l'ancre avant l'email de mi-parcours. */
  midTrialDay: { key: "beta.midtrial.day", default: 15 },
  /** Jours après l'activation avant le bilan (fin de phase active). */
  bilanDay: { key: "beta.bilan.day", default: 21 },
  /** Délai (heures) après l'envoi de l'invitation avant la relance « sans activité ». */
  nudgeHours: { key: "beta.nudge.hours", default: 48 },
  /** Mises en situation TERMINÉES qui déclenchent le feedback sans attendre la date limite. */
  feedbackSims: { key: "beta.feedback.sims", default: 3 },
  /** Délai maximal (jours depuis l'activation) avant de solliciter l'impression à chaud. */
  feedbackLatestDay: { key: "beta.feedback.latestday", default: 7 },
} as const;

/** Libellé de repli du forfait bêta pour les emails, quand `plan.label` (source de
 *  vérité en base) n'a pas pu être lu. La `key` réelle est en config (BETA_CONFIG.planKey). */
export const BETA_PLAN_LABEL = "Praticien";

/** Durée de validité par défaut d'un CODE d'invitation, en jours (sans rapport avec l'essai). */
export const BETA_INVITE_EXPIRY_DAYS = 30;
