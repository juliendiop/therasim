"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { tenantCanAccess } from "@/lib/entitlements";
import {
  closeLiveSession,
  createLiveSession,
  openLive,
  roleCanManageLive,
  startCountdown,
  type Pair,
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
  const mode = String(formData.get("mode") ?? "evaluation") as "apprentissage" | "evaluation";
  const durationMin = Math.max(1, Math.min(180, Number(formData.get("durationMin") ?? 15)));
  const competencies = formData.getAll("competency").map(String).filter(Boolean);

  if (!frameworkId || competencies.length === 0) redirect("/sessions?erreur=incomplet");
  if (!(await tenantCanAccess(user.tenantId, frameworkId))) redirect("/sessions");

  const pairs: Pair[] = competencies.map((code) => ({ frameworkId, code }));
  const session = await createLiveSession({
    tenantId: user.tenantId,
    createdBy: user.id,
    titre,
    pairs,
    mode,
    durationMin,
  });
  redirect(`/sessions/${session.id}`);
}

async function ownedSession(id: string, tenantId: string) {
  const s = await prisma.liveSession.findUnique({ where: { id } });
  return s && s.tenantId === tenantId ? s : null;
}

// Ouvre le sas (lien actif, participants peuvent rejoindre et patienter).
export async function openSessionAction(formData: FormData) {
  const user = await requireTrainer();
  const id = String(formData.get("id"));
  if (await ownedSession(id, user.tenantId)) await openLive(id);
  revalidatePath(`/sessions/${id}`);
}

// Déclenche le compte à rebours (durée éventuellement ajustée juste avant).
export async function startCountdownAction(formData: FormData) {
  const user = await requireTrainer();
  const id = String(formData.get("id"));
  const durationMin = Number(formData.get("durationMin") ?? 0) || undefined;
  if (await ownedSession(id, user.tenantId)) await startCountdown(id, durationMin);
  revalidatePath(`/sessions/${id}`);
}

export async function closeSessionAction(formData: FormData) {
  const user = await requireTrainer();
  const id = String(formData.get("id"));
  if (await ownedSession(id, user.tenantId)) await closeLiveSession(id);
  revalidatePath(`/sessions/${id}`);
}
