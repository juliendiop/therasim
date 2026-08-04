"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { LLM_USAGES, setConfig, isEuOnlyUsage } from "@/lib/config";
import { getPricingEntries, setPricingEntries } from "@/lib/llm-log";
import type { PricingEntry } from "@/lib/llm-pricing";

/** Règle la démo publique jouable : interrupteur, budget quotidien, seuil d'alerte. */
export async function setDemoConfigAction(formData: FormData) {
  await requireSuperAdmin();
  await setConfig("demo.enabled", formData.get("enabled") != null ? "1" : "0");
  const budget = parseInt(String(formData.get("budget") ?? ""), 10);
  if (Number.isFinite(budget) && budget > 0) await setConfig("demo.budget.daily", String(budget));
  const threshold = parseInt(String(formData.get("threshold") ?? ""), 10);
  if (Number.isFinite(threshold) && threshold > 0 && threshold <= 100) {
    await setConfig("demo.alert.threshold", String(threshold));
  }
  revalidatePath("/admin/modeles");
}

export async function setModelsAction(formData: FormData) {
  await requireSuperAdmin();
  for (const u of LLM_USAGES) {
    // Usage verrouillé UE : on n'écrit aucun fournisseur, même si le formulaire en
    // envoie un (requête forgée). `getLlm` force déjà Mistral, mais on évite de
    // laisser en base une valeur qui laisserait croire à un réglage effectif.
    if (isEuOnlyUsage(u.key)) {
      const model = String(formData.get(`model.${u.key}`) ?? "").trim();
      if (model) await setConfig(`model.${u.key}`, model);
      continue;
    }
    const provider = String(formData.get(`provider.${u.key}`) ?? "").trim();
    if (provider === "mistral" || provider === "anthropic") {
      await setConfig(`provider.${u.key}`, provider);
    }
    const model = String(formData.get(`model.${u.key}`) ?? "").trim();
    if (model) await setConfig(`model.${u.key}`, model);
  }
  revalidatePath("/admin/modeles");
}

/**
 * Enregistre les tarifs par couple fournisseur/modèle (€/million de tokens : entrée,
 * sortie, écriture de cache, lecture de cache). Chaque enregistrement crée une entrée
 * DATÉE DU JOUR ; les entrées de dates antérieures sont conservées (historique) — le
 * coût déjà journalisé est de toute façon figé, jamais recalculé.
 */
export async function setPricingAction(formData: FormData) {
  await requireSuperAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const existing = await getPricingEntries();
  // On conserve l'historique (entrées strictement antérieures à aujourd'hui).
  const kept = existing.filter((e) => e.effectiveFrom.slice(0, 10) < today);

  const num = (raw: FormDataEntryValue | null): number => {
    const v = parseFloat(String(raw ?? "").replace(",", "."));
    return Number.isFinite(v) && v >= 0 ? v : NaN;
  };

  const fresh: PricingEntry[] = [];
  for (let i = 0; formData.get(`row.${i}.provider`) != null; i++) {
    const provider = String(formData.get(`row.${i}.provider`));
    if (provider !== "mistral" && provider !== "anthropic") continue;
    const model = String(formData.get(`row.${i}.model`) ?? "").trim();
    if (!model) continue;
    const input = num(formData.get(`row.${i}.input`));
    const output = num(formData.get(`row.${i}.output`));
    const cacheWrite = num(formData.get(`row.${i}.cachewrite`));
    const cacheRead = num(formData.get(`row.${i}.cacheread`));
    // Ligne entièrement vide : pas de tarif pour ce modèle (ignorée).
    if ([input, output, cacheWrite, cacheRead].every((v) => Number.isNaN(v))) continue;
    fresh.push({
      provider,
      model,
      effectiveFrom: today,
      inputPerM: Number.isNaN(input) ? 0 : input,
      outputPerM: Number.isNaN(output) ? 0 : output,
      cacheWritePerM: Number.isNaN(cacheWrite) ? 0 : cacheWrite,
      cacheReadPerM: Number.isNaN(cacheRead) ? 0 : cacheRead,
    });
  }

  await setPricingEntries([...kept, ...fresh]);
  revalidatePath("/admin/modeles");
  revalidatePath("/admin/couts");
}
