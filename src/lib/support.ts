// Support client : création de tickets, fil de discussion, accès.
//
// Deux règles structurantes :
// - Un ticket est OUVERT ou CLOS. Qui doit répondre ne se déclare pas : cela se lit
//   à `lastMessageFrom` (l'auteur du dernier message).
// - Le cloisonnement est vérifié À CHAQUE LECTURE, jamais supposé depuis l'URL.

import "server-only";
import { headers } from "next/headers";
import { prisma } from "./prisma";
import { rateLimit } from "./rate-limit";
import {
  SUBJECT_MAX,
  BODY_MAX,
  TICKETS_PER_DAY,
  parseTicketStatus,
  parseTicketType,
  ticketTypeSchema,
  type AuthorRole,
  type TicketContext,
  type TicketStatus,
  type TicketType,
} from "./support-types";

export type TicketSummary = {
  id: string;
  type: TicketType;
  subject: string;
  status: TicketStatus;
  lastMessageAt: Date;
  lastMessageFrom: AuthorRole;
  /** Vrai si la balle est dans le camp de l'admin. */
  awaitingAdmin: boolean;
};

export type TicketMessage = {
  id: string;
  authorRole: AuthorRole;
  body: string;
  createdAt: Date;
};

export type TicketDetail = TicketSummary & {
  userId: string;
  context: TicketContext | null;
  createdAt: Date;
  messages: TicketMessage[];
};

function toSummary(t: {
  id: string;
  type: string;
  subject: string;
  status: string;
  lastMessageAt: Date;
  lastMessageFrom: string;
}): TicketSummary {
  const from: AuthorRole = t.lastMessageFrom === "admin" ? "admin" : "client";
  return {
    id: t.id,
    type: parseTicketType(t.type),
    subject: t.subject,
    status: parseTicketStatus(t.status),
    lastMessageAt: t.lastMessageAt,
    lastMessageFrom: from,
    awaitingAdmin: from === "client" && parseTicketStatus(t.status) === "open",
  };
}

// --- Contexte technique ------------------------------------------------------

/**
 * Relève le contexte au moment de l'envoi, côté serveur : l'utilisateur ne saisit
 * rien et n'en a pas conscience. Aucune donnée de simulation ni clinique.
 */
async function captureContext(userId: string, page: string | null): Promise<TicketContext> {
  const h = await headers();
  const [user, sub] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.userSubscription.findUnique({ where: { userId } }),
  ]);
  const plan = sub ? await prisma.subscriptionPlan.findUnique({ where: { id: sub.planId } }) : null;

  return {
    page: page?.slice(0, 300) ?? null,
    userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
    // Fourni par Vercel à l'exécution ; absent en local.
    appVersion: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null,
    plan: plan?.label ?? null,
    subscriptionStatus: sub?.status ?? null,
    credits: user ? user.credits + user.planCredits : null,
  };
}

// --- Création & messages -----------------------------------------------------

export type CreateTicketResult =
  | { ok: true; ticketId: string }
  | { ok: false; message: string };

export async function createTicket(
  user: { id: string; tenantId: string },
  input: { type: string; subject: string; body: string; page: string | null },
): Promise<CreateTicketResult> {
  const type = ticketTypeSchema.safeParse(input.type);
  if (!type.success) return { ok: false, message: "Type de demande invalide." };

  const subject = input.subject.trim().slice(0, SUBJECT_MAX);
  const body = input.body.trim().slice(0, BODY_MAX);
  if (!subject) return { ok: false, message: "Indique un sujet." };
  if (!body) return { ok: false, message: "Décris ta demande." };

  // Plafond : 5 ouvertures par 24 h et par utilisateur.
  const quota = await rateLimit(`support-open:${user.id}`, {
    max: TICKETS_PER_DAY,
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (!quota.ok) {
    return {
      ok: false,
      message: `Tu as atteint la limite de ${TICKETS_PER_DAY} demandes par 24 heures. Réponds dans un ticket existant si c'est lié.`,
    };
  }

  const context = await captureContext(user.id, input.page);
  const now = new Date();

  const ticket = await prisma.supportTicket.create({
    data: {
      userId: user.id,
      tenantId: user.tenantId,
      type: type.data,
      subject,
      status: "open",
      context,
      lastMessageAt: now,
      lastMessageFrom: "client",
    },
  });

  await prisma.supportMessage.create({
    data: { ticketId: ticket.id, authorRole: "client", authorId: user.id, body },
  });

  return { ok: true, ticketId: ticket.id };
}

export type AddMessageResult = { ok: boolean; message: string };

/**
 * Ajoute un message au fil. `authorRole` décide aussi de qui attend une réponse.
 * Un client ne peut écrire que dans SON ticket, et seulement s'il est ouvert.
 */
export async function addMessage(
  ticketId: string,
  author: { role: AuthorRole; id: string },
  rawBody: string,
): Promise<AddMessageResult> {
  const body = rawBody.trim().slice(0, BODY_MAX);
  if (!body) return { ok: false, message: "Le message est vide." };

  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) return { ok: false, message: "Demande introuvable." };
  if (author.role === "client" && ticket.userId !== author.id) {
    return { ok: false, message: "Demande introuvable." }; // volontairement indistinct
  }
  if (parseTicketStatus(ticket.status) === "closed") {
    return { ok: false, message: "Cette demande est close." };
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.supportMessage.create({
      data: { ticketId, authorRole: author.role, authorId: author.id, body },
    }),
    prisma.supportTicket.update({
      where: { id: ticketId },
      data: { lastMessageAt: now, lastMessageFrom: author.role },
    }),
  ]);

  return { ok: true, message: "Message envoyé." };
}

// --- Lecture -----------------------------------------------------------------

export async function listUserTickets(userId: string): Promise<TicketSummary[]> {
  const rows = await prisma.supportTicket.findMany({
    where: { userId },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
  });
  return rows.map(toSummary);
}

/**
 * Détail d'un ticket. `forUserId` fourni => cloisonnement appliqué : un client qui
 * force l'URL d'un ticket qui n'est pas le sien obtient `null`, comme s'il n'existait pas.
 */
export async function getTicket(
  ticketId: string,
  forUserId?: string,
): Promise<TicketDetail | null> {
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) return null;
  if (forUserId && ticket.userId !== forUserId) return null;

  const messages = await prisma.supportMessage.findMany({
    where: { ticketId },
    orderBy: { createdAt: "asc" },
  });

  return {
    ...toSummary(ticket),
    userId: ticket.userId,
    context: (ticket.context as TicketContext | null) ?? null,
    createdAt: ticket.createdAt,
    messages: messages.map((m) => ({
      id: m.id,
      authorRole: m.authorRole === "admin" ? "admin" : "client",
      body: m.body,
      createdAt: m.createdAt,
    })),
  };
}

export type AdminTicketRow = TicketSummary & { email: string; userId: string };

/** Liste admin : par activité décroissante, ceux en attente d'abord si demandé. */
export async function listAllTickets(): Promise<AdminTicketRow[]> {
  const rows = await prisma.supportTicket.findMany({
    orderBy: { lastMessageAt: "desc" },
    take: 300,
  });
  if (rows.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.userId) } },
    select: { id: true, email: true },
  });
  const emailById = new Map(users.map((u) => [u.id, u.email]));

  return rows.map((r) => ({
    ...toSummary(r),
    userId: r.userId,
    email: emailById.get(r.userId) ?? "compte supprimé",
  }));
}

/** Ouvre ou clôt un ticket (administrateur uniquement — garde chez l'appelant). */
export async function setTicketStatus(ticketId: string, status: TicketStatus): Promise<void> {
  await prisma.supportTicket.update({ where: { id: ticketId }, data: { status } });
}

/** Supprime les tickets d'un compte (appelé à la suppression du compte). */
export async function deleteTicketsForUser(userId: string): Promise<void> {
  const tickets = await prisma.supportTicket.findMany({
    where: { userId },
    select: { id: true },
  });
  if (tickets.length === 0) return;
  const ids = tickets.map((t) => t.id);
  await prisma.$transaction([
    prisma.supportMessage.deleteMany({ where: { ticketId: { in: ids } } }),
    prisma.supportTicket.deleteMany({ where: { id: { in: ids } } }),
  ]);
}
