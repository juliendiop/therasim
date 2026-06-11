"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { LLM_USAGES, setConfig } from "@/lib/config";

export async function setModelsAction(formData: FormData) {
  await requireSuperAdmin();
  for (const u of LLM_USAGES) {
    const value = String(formData.get(`model.${u.key}`) ?? "").trim();
    if (value) await setConfig(`model.${u.key}`, value);
  }
  revalidatePath("/admin/modeles");
}
