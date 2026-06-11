"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { tenantCanAccess } from "@/lib/entitlements";
import {
  closeLiveSession,
  createLiveSession,
  roleCanManageLive,
  startLiveSession,
} from "@/lib/live";
import { prisma } from "@/lib/prisma";

async function requireTrainer() {
  const user = await requireUser();
  if (!roleCanManageLive(user.role)) redirect("/catalogue");
  return user;
}

export async function createSessionAction(formData: FormData) {
  const user = await requireTrainer();
  const titre = String(formData.get("titre") ?? "").trim() || "Session d'évaluation";
  const frameworkId = String(formData.get("frameworkId") ?? "");
  const mode = String(formData.get("mode") ?? "evaluation") as
    | "apprentissage"
    | "evaluation";
  const durationMin = Math.max(1, Math.min(180, Number(formData.get("durationMin") ?? 15)));
  const competencies = formData.getAll("competency").map(String).filter(Boolean);

  if (!frameworkId || competencies.length === 0) redirect("/sessions?erreur=incomplet");
  if (!(await tenantCanAccess(user.tenantId, frameworkId))) redirect("/sessions");

  const session = await createLiveSession({
    tenantId: user.tenantId,
    createdBy: user.id,
    titre,
    frameworkId,
    competencies,
    mode,
    durationMin,
  });
  redirect(`/sessions/${session.id}`);
}

export async function startSessionAction(formData: FormData) {
  const user = await requireTrainer();
  const id = String(formData.get("id"));
  const s = await prisma.liveSession.findUnique({ where: { id } });
  if (s && s.tenantId === user.tenantId) await startLiveSession(id);
  revalidatePath(`/sessions/${id}`);
}

export async function closeSessionAction(formData: FormData) {
  const user = await requireTrainer();
  const id = String(formData.get("id"));
  const s = await prisma.liveSession.findUnique({ where: { id } });
  if (s && s.tenantId === user.tenantId) await closeLiveSession(id);
  revalidatePath(`/sessions/${id}`);
}
