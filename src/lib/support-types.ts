// Types du support client — module PUR (union TS + zod), conformément à la
// convention du projet : les statuts sont des `String` en base, jamais des enums
// Postgres (cf. suivi/contexte/03_DECISIONS.md).

import { z } from "zod";

export const TICKET_TYPES = ["bug", "idea"] as const;
export type TicketType = (typeof TICKET_TYPES)[number];
export const ticketTypeSchema = z.enum(TICKET_TYPES);

export const TICKET_STATUSES = ["open", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const ticketStatusSchema = z.enum(TICKET_STATUSES);

export const AUTHOR_ROLES = ["client", "admin"] as const;
export type AuthorRole = (typeof AUTHOR_ROLES)[number];

export const TICKET_TYPE_LABEL: Record<TicketType, string> = {
  bug: "Anomalie",
  idea: "Amélioration",
};

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: "ouvert",
  closed: "clos",
};

/** Statut lu depuis la base : une valeur inconnue est traitée comme close. */
export function parseTicketStatus(v: string): TicketStatus {
  const parsed = ticketStatusSchema.safeParse(v);
  if (parsed.success) return parsed.data;
  console.error("[support] statut de ticket inconnu:", v);
  return "closed";
}

export function parseTicketType(v: string): TicketType {
  return ticketTypeSchema.safeParse(v).success ? (v as TicketType) : "bug";
}

/**
 * Contexte technique relevé automatiquement à l'envoi.
 * ⚠️ Ne doit JAMAIS contenir de contenu de simulation ni de donnée clinique.
 */
export type TicketContext = {
  page: string | null;
  userAgent: string | null;
  appVersion: string | null;
  plan: string | null;
  subscriptionStatus: string | null;
  credits: number | null;
};

/** Limites de saisie (garde-fous serveur, pas seulement HTML). */
export const SUBJECT_MAX = 120;
export const BODY_MAX = 4000;

/** Plafond d'ouverture : 5 tickets par tranche de 24 h et par utilisateur. */
export const TICKETS_PER_DAY = 5;
