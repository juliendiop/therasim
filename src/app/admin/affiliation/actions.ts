"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import {
  saveCommissionRates,
  markPayoutPaid,
  rejectPayoutRequest,
  creditSchoolCommissionByEmail,
  adjustCommissionByEmail,
} from "@/lib/affiliation";

// Enregistre les réglages du programme d'affiliation (taux, seuil, activation, cookie).
export async function saveAffiliationSettings(formData: FormData) {
  await requireSuperAdmin();
  const enabled = formData.get("enabled") === "on";
  const rateTier1 = Number(formData.get("rateTier1"));
  const rateTier2 = Number(formData.get("rateTier2"));
  const payoutMinEuros = Number(formData.get("payoutMinEuros"));
  const cookieDays = Number(formData.get("cookieDays"));

  await saveCommissionRates({
    enabled,
    rateTier1: Number.isFinite(rateTier1) ? rateTier1 : 20,
    rateTier2: Number.isFinite(rateTier2) ? rateTier2 : 5,
    payoutMinCents: Number.isFinite(payoutMinEuros) ? Math.round(payoutMinEuros * 100) : 5000,
    cookieDays: Number.isFinite(cookieDays) ? cookieDays : 90,
  });
  revalidatePath("/admin/affiliation");
}

// Marque une demande de paiement comme réglée (remet le solde à zéro, ou au résidu).
export async function markPayoutPaidAction(formData: FormData) {
  await requireSuperAdmin();
  const id = String(formData.get("payoutRequestId") ?? "");
  if (id) await markPayoutPaid(id);
  revalidatePath("/admin/affiliation");
}

// Rejette une demande de paiement, sans mouvement de solde.
export async function rejectPayoutAction(formData: FormData) {
  await requireSuperAdmin();
  const id = String(formData.get("payoutRequestId") ?? "");
  if (id) await rejectPayoutRequest(id);
  revalidatePath("/admin/affiliation");
}

export type CreditResult = { ok: boolean; message: string };

// Crédite manuellement une commission « école » (volet B2B, attribution manuelle).
export async function creditSchoolCommissionAction(
  _prev: CreditResult | null,
  formData: FormData,
): Promise<CreditResult> {
  await requireSuperAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const amountEuros = Number(formData.get("amountEuros"));
  const note = String(formData.get("note") ?? "").trim();
  if (!email.includes("@")) return { ok: false, message: "Email invalide." };
  if (!Number.isFinite(amountEuros) || amountEuros <= 0) {
    return { ok: false, message: "Indiquez un montant positif." };
  }
  const result = await creditSchoolCommissionByEmail(email, Math.round(amountEuros * 100), note);
  revalidatePath("/admin/affiliation");
  return result;
}

// Ajustement manuel (correction d'erreur) du solde d'un ambassadeur.
export async function adjustCommissionAction(
  _prev: CreditResult | null,
  formData: FormData,
): Promise<CreditResult> {
  await requireSuperAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const amountEuros = Number(formData.get("amountEuros"));
  const note = String(formData.get("note") ?? "").trim();
  if (!email.includes("@")) return { ok: false, message: "Email invalide." };
  if (!Number.isFinite(amountEuros) || amountEuros === 0) {
    return { ok: false, message: "Indiquez un montant non nul (positif ou négatif)." };
  }
  const result = await adjustCommissionByEmail(email, Math.round(amountEuros * 100), note);
  revalidatePath("/admin/affiliation");
  return result;
}
