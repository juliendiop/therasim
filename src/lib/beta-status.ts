// Statut d'une invitation bêta. Volontairement un `String` en base (convention du
// schéma : aucun enum natif) — le typage et l'exhaustivité viennent d'ici.
//
// Pourquoi pas un enum Postgres : ajouter une valeur passe, mais en RETIRER ou en
// RENOMMER une pousse `prisma db push` sur un chemin destructif. On garde donc la
// contrainte au niveau du code, qui est le seul écrivain de cette table.
//
// ⚠️ Convention à répercuter sur tout nouveau champ de statut (voir 03_DECISIONS.md).

import { z } from "zod";

export const BETA_INVITE_STATUS = ["PENDING", "CLAIMED", "REVOKED", "EXPIRED"] as const;

export type BetaInviteStatus = (typeof BETA_INVITE_STATUS)[number];

/** Garde à la frontière (lecture DB, entrées d'action/admin). */
export const betaInviteStatusSchema = z.enum(BETA_INVITE_STATUS);

/** Vrai si la valeur est un statut connu (narrowing sur le union). */
export function isBetaInviteStatus(v: unknown): v is BetaInviteStatus {
  return betaInviteStatusSchema.safeParse(v).success;
}

/**
 * Normalise une valeur venue de la base. Une valeur inconnue (donnée ancienne,
 * écriture manuelle en SQL) est traitée comme non réclamable plutôt que de faire
 * planter une page : on la remonte en REVOKED et on la journalise.
 */
export function parseBetaInviteStatus(v: string): BetaInviteStatus {
  const parsed = betaInviteStatusSchema.safeParse(v);
  if (parsed.success) return parsed.data;
  console.error("[beta] statut d'invitation inconnu en base:", v);
  return "REVOKED";
}

/** Libellés pour l'admin. */
export const BETA_INVITE_STATUS_LABEL: Record<BetaInviteStatus, string> = {
  PENDING: "en attente",
  CLAIMED: "réclamée",
  REVOKED: "révoquée",
  EXPIRED: "expirée",
};
