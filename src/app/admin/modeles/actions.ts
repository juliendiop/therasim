"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { LLM_USAGES, setConfig, isEuOnlyUsage } from "@/lib/config";

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
