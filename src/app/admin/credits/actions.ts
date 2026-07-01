"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { setConfig } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { grant } from "@/lib/credits";
import { isEmailConfigured, sendCustomEmail } from "@/lib/email";
import { DEFAULT_OFFERS, getOffer, renderOffer } from "@/lib/offers";

// Enregistre les réglages de crédits (quotas + coûts) dans app_config.
export async function saveCreditSettings(formData: FormData) {
  await requireSuperAdmin();
  const fields: [string, string][] = [
    ["credits.welcome", "welcome"],
    ["credits.monthly", "monthly"],
    ["credits.cost.miniscene", "costMiniscene"],
    ["credits.cost.simulation", "costSimulation"],
  ];
  for (const [cfgKey, field] of fields) {
    const n = parseInt(String(formData.get(field) ?? "").trim(), 10);
    if (Number.isFinite(n) && n >= 0) await setConfig(cfgKey, String(n));
  }
  revalidatePath("/admin/credits");
}

// Enregistre les textes des offres (sujet/corps/crédits) dans app_config.
export async function saveOffers(formData: FormData) {
  await requireSuperAdmin();
  for (const o of DEFAULT_OFFERS) {
    const subject = String(formData.get(`subject_${o.id}`) ?? "").trim();
    const body = String(formData.get(`body_${o.id}`) ?? "").trim();
    if (subject) await setConfig(`offer.${o.id}.subject`, subject);
    if (body) await setConfig(`offer.${o.id}.body`, body);
    if (o.kind === "grant") {
      const c = parseInt(String(formData.get(`credits_${o.id}`) ?? ""), 10);
      if (Number.isFinite(c) && c >= 0) await setConfig(`offer.${o.id}.credits`, String(c));
    }
  }
  revalidatePath("/admin/credits");
}

export type OfferResult = { ok: boolean; message: string };

// Envoie une offre à un utilisateur (crédite le compte si kind='grant', puis email).
export async function sendOffer(
  _prev: OfferResult | null,
  formData: FormData,
): Promise<OfferResult> {
  await requireSuperAdmin();
  const userId = String(formData.get("userId"));
  const offerId = String(formData.get("offerId"));

  const offer = await getOffer(offerId);
  if (!offer) return { ok: false, message: "Offre inconnue." };
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, message: "Utilisateur introuvable." };
  const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });
  const brand = tenant?.brandName || tenant?.nom || "MELETA";

  let granted = 0;
  if (offer.kind === "grant" && offer.credits > 0) {
    await grant(user.id, offer.credits, "admin_grant", { offer: offer.id });
    granted = offer.credits;
  }

  const { subject, body } = renderOffer(offer, {
    brand,
    credits: offer.credits,
    email: user.email,
  });

  let emailSent = false;
  let emailError: string | null = null;
  if (!isEmailConfigured()) {
    emailError = "email non configuré (RESEND_API_KEY absent côté serveur)";
  } else {
    try {
      await sendCustomEmail(user.email, subject, body);
      emailSent = true;
    } catch (e) {
      console.error("[offer] envoi échoué", e);
      emailError = "envoi refusé (clé Resend invalide ou domaine non vérifié)";
    }
  }

  revalidatePath("/admin/credits");

  if (offer.kind === "promo" && !emailSent) {
    return { ok: false, message: `Promo non envoyée : ${emailError}.` };
  }
  const parts: string[] = [];
  if (granted) parts.push(`${granted} crédits ajoutés`);
  parts.push(emailSent ? "email envoyé" : `email non envoyé (${emailError})`);
  return { ok: true, message: `${user.email} : ${parts.join(" · ")}.` };
}

export type GrantResult = { ok: boolean; message: string };

// Octroi manuel de crédits à un utilisateur (par email).
export async function grantCredits(
  _prev: GrantResult | null,
  formData: FormData,
): Promise<GrantResult> {
  await requireSuperAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const amount = parseInt(String(formData.get("amount") ?? ""), 10);
  if (!email.includes("@")) return { ok: false, message: "Email invalide." };
  if (!Number.isFinite(amount) || amount < 1) {
    return { ok: false, message: "Indiquez un montant d'au moins 1 crédit." };
  }
  const u = await prisma.user.findUnique({ where: { email } });
  if (!u) return { ok: false, message: "Aucun compte avec cet email." };

  const newBalance = await grant(u.id, amount, "admin_grant");
  revalidatePath("/admin/credits");
  return {
    ok: true,
    message: `+${amount} crédits accordés à ${email}. Nouveau solde : ${newBalance}.`,
  };
}
