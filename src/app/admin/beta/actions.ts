"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Révoque une invitation encore en attente.
 * `updateMany` conditionnel sur PENDING : une invitation déjà réclamée ne peut pas
 * être révoquée par une action concurrente (l'abonnement, lui, existe déjà).
 */
export async function revokeBetaInviteAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const id = String(formData.get("inviteId") ?? "");
  if (!id) return;

  await prisma.betaInvite.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "REVOKED" },
  });
  revalidatePath("/admin/beta");
}
