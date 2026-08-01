"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { appBaseUrlFromRequest } from "@/lib/base-url";
import { generateBetaCode } from "@/lib/beta-code";
import { BETA_INVITE_EXPIRY_DAYS } from "@/lib/beta-constants";
import { betaConfig } from "@/lib/beta-config";
import { isEmailConfigured, sendBetaInvitation } from "@/lib/email";
import { setBetaImprovements } from "@/lib/beta-bilan";

export type InviteResult = { ok: boolean; message: string } | null;

/** Envoie (ou renvoie) l'email d'invitation et horodate l'envoi. */
async function deliverInvite(inviteId: string): Promise<InviteResult> {
  const invite = await prisma.betaInvite.findUnique({ where: { id: inviteId } });
  if (!invite) return { ok: false, message: "Invitation introuvable." };
  if (!invite.email) {
    return { ok: false, message: "Cette invitation n'a pas d'email de destinataire." };
  }
  if (invite.status !== "PENDING") {
    return { ok: false, message: "Seules les invitations en attente peuvent être envoyées." };
  }
  if (!isEmailConfigured()) {
    return { ok: false, message: "Envoi d'email non configuré (RESEND_API_KEY absente)." };
  }

  const planKey = await betaConfig.planKey();
  const plan = await prisma.subscriptionPlan.findUnique({ where: { key: planKey } });
  if (!plan) return { ok: false, message: `Forfait "${planKey}" introuvable.` };

  const baseUrl = await appBaseUrlFromRequest();
  try {
    await sendBetaInvitation(invite.email, {
      url: `${baseUrl}/beta/${invite.code}`,
      firstName: invite.note || null,
      planLabel: plan.label,
      monthlyCredits: plan.monthlyCredits,
      trialDays: await betaConfig.trialDays(),
    });
  } catch (e) {
    console.error("[beta] envoi d'invitation échoué", invite.email, e);
    return { ok: false, message: "L'envoi a échoué. Le code reste valide, réessayez." };
  }

  await prisma.betaInvite.update({
    where: { id: invite.id },
    data: { emailSentAt: new Date() },
  });
  return { ok: true, message: `Invitation envoyée à ${invite.email}.` };
}

/** Crée une invitation nominative et l'envoie dans la foulée. */
export async function inviteBetaTesterAction(
  _prev: InviteResult,
  formData: FormData,
): Promise<InviteResult> {
  await requireSuperAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const cohort = String(formData.get("cohort") ?? "").trim() || "beta-2026-01";
  if (!email.includes("@")) return { ok: false, message: "Email invalide." };

  const expiresAt = new Date(Date.now() + BETA_INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const invite = await prisma.betaInvite.create({
    data: {
      code: generateBetaCode(),
      email,
      note: firstName || null,
      cohort,
      status: "PENDING",
      expiresAt,
    },
  });

  const result = await deliverInvite(invite.id);
  revalidatePath("/admin/beta");
  return result;
}

/** Renvoie une invitation déjà créée (envoi initial raté, email perdu…). */
export async function resendBetaInviteAction(
  _prev: InviteResult,
  formData: FormData,
): Promise<InviteResult> {
  await requireSuperAdmin();
  const id = String(formData.get("inviteId") ?? "");
  if (!id) return { ok: false, message: "Invitation manquante." };
  const result = await deliverInvite(id);
  revalidatePath("/admin/beta");
  return result;
}

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

/**
 * Enregistre les « améliorations concrètes » (une par ligne) affichées dans l'email
 * de bilan J+21. Vide = le paragraphe correspondant est masqué dans l'email.
 */
export async function saveBetaImprovementsAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const text = String(formData.get("improvements") ?? "");
  await setBetaImprovements(text);
  revalidatePath("/admin/beta");
}
