"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { setCostThresholds } from "@/lib/cost-analytics";

/** Règle les seuils d'alerte de coût (dépense mensuelle par utilisateur, plafond quotidien
 *  global) et l'objectif de coût par crédit. Aucun envoi d'email : flag visuel + trace en base. */
export async function setCostThresholdsAction(formData: FormData) {
  await requireSuperAdmin();
  const num = (raw: FormDataEntryValue | null): number | undefined => {
    const v = parseFloat(String(raw ?? "").replace(",", "."));
    return Number.isFinite(v) && v > 0 ? v : undefined;
  };
  await setCostThresholds({
    userMonthly: num(formData.get("userMonthly")),
    dailyGlobal: num(formData.get("dailyGlobal")),
    targetPerCredit: num(formData.get("targetPerCredit")),
  });
  revalidatePath("/admin/couts");
}
