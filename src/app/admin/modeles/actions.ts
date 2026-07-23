"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { LLM_USAGES, setConfig, isEuOnlyUsage } from "@/lib/config";

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
