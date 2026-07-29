"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { userCanAccess, resolveB2CEntitlement } from "@/lib/entitlements";
import { checkSimulationAllowance } from "@/lib/usage-limits";
import { startSimulation } from "@/lib/simulator";
import { topPriorityCodes } from "@/lib/next-drill";
import {
  creditSettings,
  debit,
  grant,
  isUnlimited,
  InsufficientCreditsError,
} from "@/lib/credits";

export async function startSimulationAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const frameworkId = String(formData.get("frameworkId"));
  const scenarioId = String(formData.get("scenarioId"));
  if (!(await userCanAccess(user, frameworkId))) redirect(`/f/${frameworkId}`);

  const ent = await resolveB2CEntitlement(user.id);

  // --- Compte gratuit (Découverte) : UNE séance complète dans la vie du compte,
  // gratuite en crédits. Porte d'accès N3, tracée par discoveryInterviewUsedAt
  // (jamais réinitialisée par la recharge mensuelle).
  if (!ent.entitledSub) {
    // Réservation atomique : ne « brûle » la séance gratuite que si encore disponible.
    const claimed = await prisma.user.updateMany({
      where: { id: user.id, discoveryInterviewUsedAt: null },
      data: { discoveryInterviewUsedAt: new Date() },
    });
    if (claimed.count === 0) {
      // Déjà utilisé : message d'explication + proposition d'abonnement (pas une erreur).
      redirect(`/credits?need=discovery&fw=${frameworkId}`);
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
      // Échec technique : on rend sa séance découverte (ne pas pénaliser).
      await prisma.user.update({
        where: { id: user.id },
        data: { discoveryInterviewUsedAt: null },
      });
      throw e;
    }
    revalidatePath("/", "layout");
    redirect(`/sim/${sessionId}`);
  }

  // --- Forfait payant : usage loyal (anti-abus) puis débit (court-circuité si « sans
  // compter »). Vérifié AVANT tout débit, donc un refus ne consomme rien.
  const allowance = await checkSimulationAllowance(user.id);
  if (!allowance.ok) redirect(`/f/${frameworkId}?fairuse=${allowance.scope}`);

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
    // La création a échoué : on rembourse le crédit débité (sauf « sans compter »,
    // où aucun crédit n'a été débité).
    if (!(await isUnlimited(user.id)))
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

  // Usage loyal (garde-fou anti-abus) : vérifié avant tout débit de crédit.
  const allowance = await checkSimulationAllowance(user.id);
  if (!allowance.ok) redirect(`/f/${frameworkId}?fairuse=${allowance.scope}`);

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
    if (!(await isUnlimited(user.id)))
      await grant(user.id, s.costMiniscene, "refund", { frameworkId, of: "miniscene" });
    throw e;
  }
  // Rafraîchit le compteur de crédits de l'en-tête (layout racine).
  revalidatePath("/", "layout");
  redirect(`/sim/${sessionId}`);
}
