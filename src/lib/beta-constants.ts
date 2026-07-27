// Constantes de la bêta fermée — module PUR, sans dépendance serveur, pour être
// importable aussi bien depuis l'app que depuis les scripts (`server-only` ferait
// échouer l'import dans un script tsx).

/** `key` du forfait offert aux bêta-testeurs (table subscription_plans). */
export const BETA_PLAN_KEY = "intensif";

/** Libellé de repli du forfait bêta pour les emails, quand le libellé réel (plan.label,
 *  source de vérité en base) n'a pas pu être lu. Centralisé ici pour éviter un littéral
 *  « Intensif » dispersé dans le code. */
export const BETA_PLAN_LABEL = "Intensif";

/** Durée de l'essai offert, en jours. */
export const BETA_TRIAL_DAYS = 90;

/** Durée de validité par défaut d'un CODE d'invitation, en jours. */
export const BETA_INVITE_EXPIRY_DAYS = 30;
