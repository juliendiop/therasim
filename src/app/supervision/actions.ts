"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canSupervise } from "@/lib/roles";
import { addNote, getLearnerInTenant } from "@/lib/supervision";

export async function addNoteAction(formData: FormData) {
  const user = await requireUser();
  if (!canSupervise(user.role)) redirect("/accueil");

  const learnerId = String(formData.get("learnerId") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "").trim() || null;
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  const learner = await getLearnerInTenant(learnerId, user.tenantId);
  if (!learner) redirect("/supervision");

  await addNote({
    tenantId: user.tenantId,
    authorId: user.id,
    learnerId,
    sessionId,
    body,
  });

  revalidatePath(`/supervision/${learnerId}`);
  if (sessionId) revalidatePath(`/supervision/${learnerId}/sim/${sessionId}`);
}
