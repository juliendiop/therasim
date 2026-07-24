"use server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { submitBetaFeedback } from "@/lib/beta-feedback";

export type FeedbackFormState = { ok: boolean; message?: string } | null;

/** Enregistre les réponses au questionnaire « impression à chaud ». */
export async function submitFeedbackAction(
  _prev: FeedbackFormState,
  formData: FormData,
): Promise<FeedbackFormState> {
  const user = await requireUser();
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { betaCohort: true },
  });

  const res = await submitBetaFeedback({
    userId: user.id,
    tenantId: user.tenantId,
    cohort: dbUser?.betaCohort ?? null,
    input: {
      q1: String(formData.get("q1") ?? ""),
      q2: String(formData.get("q2") ?? ""),
      q3: String(formData.get("q3") ?? ""),
    },
  });

  return res.ok ? { ok: true } : { ok: false, message: res.message };
}
