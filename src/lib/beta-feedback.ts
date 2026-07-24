// Questionnaire « impression à chaud » de la bêta : 3 questions ouvertes, recueillies
// via /beta/feedback (relance email) et relues en backoffice (/admin/beta/feedback).
import "server-only";
import { prisma } from "./prisma";
import { FEEDBACK_ANSWER_MAX } from "./beta-feedback-constants";

// Ré-exporté pour les appelants serveur existants ; la source reste le module pur.
export { FEEDBACK_ANSWER_MAX, FEEDBACK_QUESTIONS } from "./beta-feedback-constants";

export type FeedbackInput = { q1: string; q2: string; q3: string };

export type SubmitFeedbackResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Enregistre une réponse. Exige au moins une des trois zones remplie (on ne stocke
 * pas une soumission vide) et borne chaque réponse. Best-effort de traçabilité :
 * `cohort` est repris du compte s'il est connu.
 */
export async function submitBetaFeedback(opts: {
  userId: string;
  tenantId: string;
  cohort: string | null;
  input: FeedbackInput;
}): Promise<SubmitFeedbackResult> {
  const q1 = opts.input.q1.trim();
  const q2 = opts.input.q2.trim();
  const q3 = opts.input.q3.trim();

  if (!q1 && !q2 && !q3) {
    return { ok: false, message: "Répondez à au moins une question avant d'envoyer." };
  }
  if (q1.length > FEEDBACK_ANSWER_MAX || q2.length > FEEDBACK_ANSWER_MAX || q3.length > FEEDBACK_ANSWER_MAX) {
    return { ok: false, message: "Une réponse dépasse la longueur autorisée." };
  }

  await prisma.betaFeedback.create({
    data: { userId: opts.userId, tenantId: opts.tenantId, cohort: opts.cohort, q1, q2, q3 },
  });
  return { ok: true };
}

export type FeedbackRow = {
  id: string;
  email: string;
  cohort: string | null;
  q1: string;
  q2: string;
  q3: string;
  createdAt: Date;
};

/** Liste des réponses (backoffice), la plus récente d'abord, avec l'email de l'auteur. */
export async function listBetaFeedback(take = 300): Promise<FeedbackRow[]> {
  const rows = await prisma.betaFeedback.findMany({
    orderBy: { createdAt: "desc" },
    take,
  });
  if (rows.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.userId) } },
    select: { id: true, email: true },
  });
  const emailById = new Map(users.map((u) => [u.id, u.email]));

  return rows.map((r) => ({
    id: r.id,
    email: emailById.get(r.userId) ?? "—",
    cohort: r.cohort,
    q1: r.q1,
    q2: r.q2,
    q3: r.q3,
    createdAt: r.createdAt,
  }));
}
