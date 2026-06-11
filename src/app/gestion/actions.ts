"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, type Role } from "@/lib/auth";
import { ASSIGNABLE_ROLES, canManageMembers } from "@/lib/roles";

async function requireManager() {
  const user = await requireUser();
  if (!canManageMembers(user.role)) redirect("/catalogue");
  return user;
}

function isAssignable(role: string): role is Role {
  return ASSIGNABLE_ROLES.some((r) => r.value === role);
}

export async function createMember(formData: FormData) {
  const manager = await requireManager();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "learner");
  if (!email.includes("@") || !isAssignable(role)) redirect("/gestion?erreur=invalide");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) redirect("/gestion?erreur=existe");

  await prisma.user.create({
    data: { email, role, tenantId: manager.tenantId },
  });
  revalidatePath("/gestion");
}

export async function updateMemberRole(formData: FormData) {
  const manager = await requireManager();
  const id = String(formData.get("id"));
  const role = String(formData.get("role"));
  if (!isAssignable(role)) return;
  const target = await prisma.user.findUnique({ where: { id } });
  // On ne touche qu'aux membres de sa propre plateforme, jamais un super-admin.
  if (!target || target.tenantId !== manager.tenantId || target.role === "super_admin") return;
  await prisma.user.update({ where: { id }, data: { role } });
  revalidatePath("/gestion");
}

export async function removeMember(formData: FormData) {
  const manager = await requireManager();
  const id = String(formData.get("id"));
  if (id === manager.id) return; // pas soi-même
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.tenantId !== manager.tenantId || target.role === "super_admin") return;
  await prisma.user.delete({ where: { id } });
  revalidatePath("/gestion");
}
