"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createMagicToken, requireUser, type Role } from "@/lib/auth";
import { appBaseUrlFromRequest } from "@/lib/base-url";
import { logAudit } from "@/lib/audit";
import { isEmailConfigured, sendInvitation } from "@/lib/email";
import { ASSIGNABLE_ROLES, ROLE_LABELS, canManageMembers } from "@/lib/roles";
import { deleteTicketsForUser } from "@/lib/support";

async function requireManager() {
  const user = await requireUser();
  if (!canManageMembers(user.role)) redirect("/catalogue");
  return user;
}

function isAssignable(role: string): role is Role {
  return ASSIGNABLE_ROLES.some((r) => r.value === role);
}

export type MemberResult = {
  ok: boolean;
  message: string;
  inviteLink?: string;
  emailSent?: boolean;
};

export async function createMember(
  _prev: MemberResult | null,
  formData: FormData,
): Promise<MemberResult> {
  const manager = await requireManager();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "learner") as Role;
  if (!email.includes("@") || !isAssignable(role)) {
    return { ok: false, message: "Email ou rôle invalide." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { ok: false, message: "Cet email a déjà un compte." };

  await prisma.user.create({ data: { email, role, tenantId: manager.tenantId } });
  await logAudit({
    action: "invite",
    email: manager.email,
    tenantId: manager.tenantId,
    userId: manager.id,
    meta: { target: email, role },
  });

  // Lien d'invitation longue durée (7 jours) qui connecte directement.
  const token = await createMagicToken(email, manager.tenantId, 60 * 24 * 7);
  const base = await appBaseUrlFromRequest();
  const inviteLink = `${base}/api/auth/callback?token=${token}`;

  const tenant = await prisma.tenant.findUnique({ where: { id: manager.tenantId } });
  const brandName = tenant?.brandName || tenant?.nom || "MELETA";

  let emailSent = false;
  if (isEmailConfigured()) {
    try {
      await sendInvitation(email, inviteLink, brandName, ROLE_LABELS[role]);
      emailSent = true;
    } catch (e) {
      console.error("[invitation] échec envoi", e);
    }
  }

  revalidatePath("/gestion");
  return {
    ok: true,
    message: emailSent
      ? `Invitation envoyée à ${email}.`
      : `Membre ajouté. Partagez-lui le lien d'invitation ci-dessous.`,
    inviteLink,
    emailSent,
  };
}

// (Re)génère un lien de connexion (magique, 7 jours) pour un membre déjà inscrit.
export async function createMemberInvite(
  _prev: MemberResult | null,
  formData: FormData,
): Promise<MemberResult> {
  const manager = await requireManager();
  const id = String(formData.get("id"));
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.tenantId !== manager.tenantId || target.role === "super_admin") {
    return { ok: false, message: "Membre introuvable." };
  }

  const token = await createMagicToken(target.email, manager.tenantId, 60 * 24 * 7);
  const base = await appBaseUrlFromRequest();
  const inviteLink = `${base}/api/auth/callback?token=${token}`;

  const tenant = await prisma.tenant.findUnique({ where: { id: manager.tenantId } });
  const brandName = tenant?.brandName || tenant?.nom || "MELETA";

  let emailSent = false;
  if (isEmailConfigured()) {
    try {
      await sendInvitation(target.email, inviteLink, brandName, ROLE_LABELS[target.role as Role]);
      emailSent = true;
    } catch (e) {
      console.error("[invite] échec envoi", e);
    }
  }

  await logAudit({
    action: "invite",
    email: manager.email,
    tenantId: manager.tenantId,
    userId: manager.id,
    meta: { target: target.email, role: target.role, resend: true },
  });

  return {
    ok: true,
    message: emailSent
      ? `Lien renvoyé par email à ${target.email}.`
      : `Lien de connexion généré (valable 7 jours).`,
    inviteLink,
    emailSent,
  };
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
  await logAudit({
    action: "role_change",
    email: manager.email,
    tenantId: manager.tenantId,
    userId: manager.id,
    meta: { target: target.email, role },
  });
  revalidatePath("/gestion");
}

export async function removeMember(formData: FormData) {
  const manager = await requireManager();
  const id = String(formData.get("id"));
  if (id === manager.id) return; // pas soi-même
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.tenantId !== manager.tenantId || target.role === "super_admin") return;
  // La suppression d'un compte entraîne celle de ses tickets (et de leurs messages).
  // Le schéma ne déclare aucune relation, donc aucune cascade : c'est explicite ici.
  await deleteTicketsForUser(id);
  await prisma.user.delete({ where: { id } });
  await logAudit({
    action: "member_removed",
    email: manager.email,
    tenantId: manager.tenantId,
    userId: manager.id,
    meta: { target: target.email },
  });
  revalidatePath("/gestion");
}
