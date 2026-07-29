"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { setConfig } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { FREE_FRAMEWORKS_CONFIG_KEY } from "@/lib/entitlements";

// Met à jour un pack de crédits (source de vérité : modèle CreditPack). Crédits et prix
// sont ceux affichés/facturés ; les achats passés gardent leurs valeurs figées (metadata).
export async function saveCreditPack(formData: FormData) {
  await requireSuperAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  const credits = parseInt(String(formData.get("credits") ?? ""), 10);
  const priceEur = parseFloat(String(formData.get("priceEur") ?? ""));
  const stripePriceId = String(formData.get("stripePriceId") ?? "").trim();
  const active = formData.get("active") != null;

  const data: {
    stripePriceId: string | null;
    active: boolean;
    credits?: number;
    priceEurCents?: number;
  } = { stripePriceId: stripePriceId || null, active };
  if (Number.isFinite(credits) && credits >= 1) data.credits = credits;
  if (Number.isFinite(priceEur) && priceEur >= 0) data.priceEurCents = Math.round(priceEur * 100);

  await prisma.creditPack.update({ where: { id }, data });
  revalidatePath("/admin/facturation");
  revalidatePath("/credits");
}

// Crée un nouveau forfait d'abonnement (nom/prix/crédits/quota définis par l'admin —
// jamais en dur côté code). Le Price ID Stripe peut être ajouté après coup.
export async function createPlan(formData: FormData) {
  await requireSuperAdmin();
  const key = String(formData.get("key") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  // Allocation mensuelle. Vide = « sans compter » (null) ; sinon un entier >= 0.
  const mcRaw = String(formData.get("monthlyCredits") ?? "").trim();
  const monthlyCredits = mcRaw === "" ? null : parseInt(mcRaw, 10);
  const priceEur = parseFloat(String(formData.get("priceEur") ?? ""));
  const stripePriceId = String(formData.get("stripePriceId") ?? "").trim();
  const stripePriceIdYearly = String(formData.get("stripePriceIdYearly") ?? "").trim();
  // Quota de SPÉCIALITÉS au choix de l'abonné. Vide = toutes les spécialités.
  const quotaRaw = String(formData.get("frameworkQuota") ?? "").trim();
  const quota = quotaRaw === "" ? null : parseInt(quotaRaw, 10);

  if (!key || !label) return;
  if (monthlyCredits !== null && (!Number.isFinite(monthlyCredits) || monthlyCredits < 0)) return;
  if (!Number.isFinite(priceEur) || priceEur < 0) return;
  if (quota !== null && (!Number.isFinite(quota) || quota < 1)) return;

  const count = await prisma.subscriptionPlan.count();
  await prisma.subscriptionPlan.create({
    data: {
      key,
      label,
      monthlyCredits,
      frameworkQuota: quota,
      priceEurCents: Math.round(priceEur * 100),
      stripePriceId: stripePriceId || null,
      stripePriceIdYearly: stripePriceIdYearly || null,
      ordre: count,
    },
  });
  revalidatePath("/admin/facturation");
}

// Active/désactive un forfait (ne le supprime pas — les abonnés existants ne sont pas affectés).
export async function togglePlanActive(formData: FormData) {
  await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id } });
  if (!plan) return;
  await prisma.subscriptionPlan.update({ where: { id }, data: { active: !plan.active } });
  revalidatePath("/admin/facturation");
}

// Met à jour un forfait existant : Price ID Stripe, quota de spécialités, et allocation
// mensuelle (vide = « sans compter »).
export async function updatePlanPriceId(formData: FormData) {
  await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const stripePriceId = String(formData.get("stripePriceId") ?? "").trim();
  const stripePriceIdYearly = String(formData.get("stripePriceIdYearly") ?? "").trim();
  const quotaRaw = String(formData.get("frameworkQuota") ?? "").trim();
  const quota = quotaRaw === "" ? null : parseInt(quotaRaw, 10);
  if (quota !== null && (!Number.isFinite(quota) || quota < 1)) return;

  // Champs présents (inputs rendus) : "" a un sens différent selon le champ.
  const mcRaw = formData.get("monthlyCredits");
  const data: {
    stripePriceId: string | null;
    stripePriceIdYearly: string | null;
    frameworkQuota: number | null;
    monthlyCredits?: number | null;
    priceEurCents?: number;
  } = {
    stripePriceId: stripePriceId || null,
    stripePriceIdYearly: stripePriceIdYearly || null,
    frameworkQuota: quota,
  };
  if (mcRaw !== null) {
    const s = String(mcRaw).trim();
    if (s === "") data.monthlyCredits = null; // vide = « sans compter »
    else {
      const n = parseInt(s, 10);
      if (Number.isFinite(n) && n >= 0) data.monthlyCredits = n;
    }
  }
  // Prix mensuel affiché (€) : on ne touche à `priceEurCents` que si une valeur valide
  // est fournie (vide => on garde le prix actuel, jamais 0 par accident).
  const priceRaw = formData.get("priceEur");
  if (priceRaw !== null) {
    const s = String(priceRaw).trim();
    if (s !== "") {
      const n = parseFloat(s);
      if (Number.isFinite(n) && n >= 0) data.priceEurCents = Math.round(n * 100);
    }
  }

  await prisma.subscriptionPlan.update({ where: { id }, data });
  revalidatePath("/admin/facturation");
  revalidatePath("/tarifs");
}

// Enregistre l'offre à l'unité d'un référentiel (prix affiché + Price ID + actif).
export async function saveFrameworkOffer(formData: FormData) {
  await requireSuperAdmin();
  const frameworkId = String(formData.get("frameworkId") ?? "");
  const priceEur = parseFloat(String(formData.get("priceEur") ?? ""));
  const stripePriceId = String(formData.get("stripePriceId") ?? "").trim();
  const active = formData.get("active") === "on";
  if (!frameworkId || !Number.isFinite(priceEur) || priceEur < 0) return;

  const priceEurCents = Math.round(priceEur * 100);
  await prisma.frameworkOffer.upsert({
    where: { frameworkId },
    update: { priceEurCents, stripePriceId: stripePriceId || null, active },
    create: { frameworkId, priceEurCents, stripePriceId: stripePriceId || null, active },
  });
  revalidatePath("/admin/facturation");
}

// Enregistre la liste des référentiels GRATUITS à l'inscription (CSV en app_config).
export async function saveFreeFrameworks(formData: FormData) {
  await requireSuperAdmin();
  const ids = formData.getAll("free").map(String).filter(Boolean);
  await setConfig(FREE_FRAMEWORKS_CONFIG_KEY, ids.join(","));
  revalidatePath("/admin/facturation");
}
