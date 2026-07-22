"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { runAnalysis } from "@/lib/growth-advisor";

/** Lance une analyse de croissance (IA) et rafraîchit la page. */
export async function runAnalysisAction() {
  await requireSuperAdmin();
  try {
    await runAnalysis();
  } catch (e) {
    // L'erreur est affichée via le message de la page (analyse inchangée).
    return { error: e instanceof Error ? e.message : "Analyse impossible." };
  }
  revalidatePath("/admin/optimisation");
  return { error: null };
}
