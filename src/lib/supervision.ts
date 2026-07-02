// Espace supervision formateur : visibilité (lecture seule) sur la progression
// et les mises en situation des apprenants de sa plateforme, + notes.
// Toute lecture est scopée au tenant de l'appelant (jamais cross-tenant).

import { prisma } from "./prisma";

export type LearnerRow = {
  id: string;
  email: string;
  createdAt: Date;
  lastActivity: Date | null;
  attemptsCount: number;
  simCount: number;
};

/** Liste des apprenants du tenant, avec un aperçu d'activité. */
export async function listLearners(
  tenantId: string,
  emailFilter?: string,
): Promise<LearnerRow[]> {
  const learners = await prisma.user.findMany({
    where: {
      tenantId,
      role: "learner",
      ...(emailFilter ? { email: { contains: emailFilter, mode: "insensitive" } } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  if (learners.length === 0) return [];

  const ids = learners.map((l) => l.id);
  const [attemptStats, simStats, lastAttempts, lastSims] = await Promise.all([
    prisma.attempt.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _count: { _all: true } }),
    prisma.simSession.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _count: { _all: true } }),
    prisma.attempt.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _max: { createdAt: true } }),
    prisma.simSession.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _max: { createdAt: true } }),
  ]);
  const attemptCountByUser = new Map(attemptStats.map((s) => [s.userId, s._count._all]));
  const simCountByUser = new Map(simStats.map((s) => [s.userId, s._count._all]));
  const lastAttemptByUser = new Map(lastAttempts.map((s) => [s.userId, s._max.createdAt]));
  const lastSimByUser = new Map(lastSims.map((s) => [s.userId, s._max.createdAt]));

  return learners.map((l) => {
    const a = lastAttemptByUser.get(l.id) ?? null;
    const s = lastSimByUser.get(l.id) ?? null;
    const lastActivity = !a ? s : !s ? a : a > s ? a : s;
    return {
      id: l.id,
      email: l.email,
      createdAt: l.createdAt,
      lastActivity,
      attemptsCount: attemptCountByUser.get(l.id) ?? 0,
      simCount: simCountByUser.get(l.id) ?? 0,
    };
  });
}

/** Vérifie que l'apprenant appartient bien au tenant de l'appelant (garde anti cross-tenant). */
export async function getLearnerInTenant(learnerId: string, tenantId: string) {
  const learner = await prisma.user.findUnique({ where: { id: learnerId } });
  if (!learner || learner.tenantId !== tenantId || learner.role !== "learner") return null;
  return learner;
}

export type SupervisorNoteRow = {
  id: string;
  authorEmail: string;
  sessionId: string | null;
  body: string;
  createdAt: Date;
};

export async function listNotes(
  tenantId: string,
  learnerId: string,
): Promise<SupervisorNoteRow[]> {
  const notes = await prisma.supervisorNote.findMany({
    where: { tenantId, learnerId },
    orderBy: { createdAt: "desc" },
  });
  if (notes.length === 0) return [];
  const authors = await prisma.user.findMany({
    where: { id: { in: [...new Set(notes.map((n) => n.authorId))] } },
  });
  const emailById = new Map(authors.map((a) => [a.id, a.email]));
  return notes.map((n) => ({
    id: n.id,
    authorEmail: emailById.get(n.authorId) ?? "—",
    sessionId: n.sessionId,
    body: n.body,
    createdAt: n.createdAt,
  }));
}

export async function addNote(input: {
  tenantId: string;
  authorId: string;
  learnerId: string;
  sessionId?: string | null;
  body: string;
}): Promise<void> {
  await prisma.supervisorNote.create({
    data: {
      tenantId: input.tenantId,
      authorId: input.authorId,
      learnerId: input.learnerId,
      sessionId: input.sessionId || null,
      body: input.body,
    },
  });
}
