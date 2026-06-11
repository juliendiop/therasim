"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { tenantCanAccess } from "@/lib/entitlements";
import { startSimulation } from "@/lib/simulator";
import { topPriorityCodes } from "@/lib/next-drill";

export async function startSimulationAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const frameworkId = String(formData.get("frameworkId"));
  const scenarioId = String(formData.get("scenarioId"));
  if (!(await tenantCanAccess(user.tenantId, frameworkId))) redirect("/catalogue");

  const { sessionId } = await startSimulation({
    userId: user.id,
    tenantId: user.tenantId,
    frameworkId,
    scenarioId,
  });
  redirect(`/sim/${sessionId}`);
}

// Mini-scène (N2) : cible automatiquement les 2 compétences prioritaires, ~4 tours, indices.
export async function startMiniSceneAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const frameworkId = String(formData.get("frameworkId"));
  if (!(await tenantCanAccess(user.tenantId, frameworkId))) redirect("/catalogue");

  const scenario = await prisma.scenario.findFirst({ where: { frameworkId } });
  if (!scenario) redirect(`/f/${frameworkId}`);

  const focus = await topPriorityCodes(user.id, frameworkId, 2);

  const { sessionId } = await startSimulation({
    userId: user.id,
    tenantId: user.tenantId,
    frameworkId,
    scenarioId: scenario!.id,
    kind: "miniscene",
    focus,
    maxTurns: 4,
  });
  redirect(`/sim/${sessionId}`);
}
