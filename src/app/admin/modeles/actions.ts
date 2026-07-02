"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { LLM_USAGES, setConfig } from "@/lib/config";

export async function setModelsAction(formData: FormData) {
  await requireSuperAdmin();
  for (const u of LLM_USAGES) {
    const provider = String(formData.get(`provider.${u.key}`) ?? "").trim();
    if (provider === "mistral" || provider === "anthropic") {
      await setConfig(`provider.${u.key}`, provider);
    }
    const model = String(formData.get(`model.${u.key}`) ?? "").trim();
    if (model) await setConfig(`model.${u.key}`, model);
  }
  revalidatePath("/admin/modeles");
}
