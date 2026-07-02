"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { setConfig } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { CREDIT_PACKS } from "@/lib/credits";
import { FREE_FRAMEWORKS_CONFIG_KEY } from "@/lib/entitlements";

// Price ID Stripe (paiement unique) de chaque pack de crédits — stocké en app_config,
// même mécanisme que la config des modèles LLM (voir src/lib/config.ts).
export async function savePackPriceIds(formData: FormData) {
  await requireSuperAdmin();
  for (const pack of CREDIT_PACKS) {
    const value = String(formData.get(`price_${pack.id}`) ?? "").trim();
    await setConfig(`stripe.price.pack.${pack.id}`, value);
  }
  revalidatePath("/admin/facturation");
}

// Crée un nouveau forfait d'abonnement (nom/prix/crédits définis par l'admin —
// jamais en dur côté code). Le Price ID Stripe peut être ajouté après coup.
export async function createPlan(formData: FormData) {
  await requireSuperAdmin();
  const key = String(formData.get("key") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const monthlyCredits = parseInt(String(formData.get("monthlyCredits") ?? ""), 10);
  const priceEur = parseFloat(String(formData.get("priceEur") ?? ""));
  const stripePriceId = String(formData.get("stripePriceId") ?? "").trim();

  if (!key || !label) return;
  if (!Number.isFinite(monthlyCredits) || monthlyCredits < 1) return;
  if (!Number.isFinite(priceEur) || priceEur < 0) return;

  const count = await prisma.subscriptionPlan.count();
  await prisma.subscriptionPlan.create({
    data: {
      key,
      label,
      monthlyCredits,
      priceEurCents: Math.round(priceEur * 100),
      stripePriceId: stripePriceId || null,
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

// Met à jour le Price ID Stripe d'un forfait existant (créé côté Stripe après coup).
export async function updatePlanPriceId(formData: FormData) {
  await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const stripePriceId = String(formData.get("stripePriceId") ?? "").trim();
  await prisma.subscriptionPlan.update({
    where: { id },
    data: { stripePriceId: stripePriceId || null },
  });
  revalidatePath("/admin/facturation");
}

// Ajoute/retire un référentiel d'un forfait (même pattern que togglePackFramework).
export async function togglePlanFramework(formData: FormData) {
  await requireSuperAdmin();
  const planId = String(formData.get("planId") ?? "");
  const frameworkId = String(formData.get("frameworkId") ?? "");
  if (!planId || !frameworkId) return;

  const existing = await prisma.planFramework.findUnique({
    where: { planId_frameworkId: { planId, frameworkId } },
  });
  if (existing) {
    await prisma.planFramework.delete({
      where: { planId_frameworkId: { planId, frameworkId } },
    });
  } else {
    await prisma.planFramework.create({ data: { planId, frameworkId } });
  }
  revalidatePath("/admin/facturation");
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
