"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { userCanAccess } from "@/lib/entitlements";
import { startSimulation } from "@/lib/simulator";
import { topPriorityCodes } from "@/lib/next-drill";
import {
  creditSettings,
  debit,
  grant,
  InsufficientCreditsError,
} from "@/lib/credits";

export async function startSimulationAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const frameworkId = String(formData.get("frameworkId"));
  const scenarioId = String(formData.get("scenarioId"));
  if (!(await userCanAccess(user, frameworkId))) redirect(`/f/${frameworkId}`);

  // Débit du portefeuille (entretien simulé). Redirige si solde insuffisant.
  const s = await creditSettings();
  try {
    await debit(user.id, s.costSimulation, "consume_simulation", { frameworkId });
  } catch (e) {
    if (e instanceof InsufficientCreditsError)
      redirect(`/credits?need=simulation&fw=${frameworkId}`);
    throw e;
  }

  let sessionId: string;
  try {
    ({ sessionId } = await startSimulation({
      userId: user.id,
      tenantId: user.tenantId,
      frameworkId,
      scenarioId,
    }));
  } catch (e) {
    // La création a échoué : on rembourse le crédit débité.
    await grant(user.id, s.costSimulation, "refund", { frameworkId, of: "simulation" });
    throw e;
  }
  // Rafraîchit le compteur de crédits de l'en-tête (layout racine).
  revalidatePath("/", "layout");
  redirect(`/sim/${sessionId}`);
}

// Mini-scène (N2) : cible automatiquement les 2 compétences prioritaires, ~4 tours, indices.
export async function startMiniSceneAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const frameworkId = String(formData.get("frameworkId"));
  if (!(await userCanAccess(user, frameworkId))) redirect(`/f/${frameworkId}`);

  const scenario = await prisma.scenario.findFirst({ where: { frameworkId } });
  if (!scenario) redirect(`/f/${frameworkId}`);

  // Débit du portefeuille (mini-scène). Redirige si solde insuffisant.
  const s = await creditSettings();
  try {
    await debit(user.id, s.costMiniscene, "consume_miniscene", { frameworkId });
  } catch (e) {
    if (e instanceof InsufficientCreditsError)
      redirect(`/credits?need=miniscene&fw=${frameworkId}`);
    throw e;
  }

  const focus = await topPriorityCodes(user.id, frameworkId, 2);

  let sessionId: string;
  try {
    ({ sessionId } = await startSimulation({
      userId: user.id,
      tenantId: user.tenantId,
      frameworkId,
      scenarioId: scenario!.id,
      kind: "miniscene",
      focus,
      maxTurns: 4,
    }));
  } catch (e) {
    await grant(user.id, s.costMiniscene, "refund", { frameworkId, of: "miniscene" });
    throw e;
  }
  // Rafraîchit le compteur de crédits de l'en-tête (layout racine).
  revalidatePath("/", "layout");
  redirect(`/sim/${sessionId}`);
}
