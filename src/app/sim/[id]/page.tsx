import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import type { Debrief } from "@/lib/simulator";
import SimChat from "./sim-chat";

export const dynamic = "force-dynamic";

export default async function SimPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const session = await prisma.simSession.findUnique({ where: { id } });
  if (!session || session.userId !== user.id) notFound();

  const [scenario, framework, messages] = await Promise.all([
    prisma.scenario.findUnique({ where: { id: session.scenarioId } }),
    prisma.framework.findUnique({ where: { id: session.frameworkId } }),
    prisma.simMessage.findMany({ where: { sessionId: id }, orderBy: { turn: "asc" } }),
  ]);

  // Mini-scène (N2) : résout les noms des compétences ciblées.
  const focusCodes = Array.isArray(session.focus) ? (session.focus as string[]) : [];
  let focusNoms: string[] = [];
  if (session.kind === "miniscene" && framework && focusCodes.length > 0) {
    const comps = await prisma.competency.findMany({
      where: { gridId: framework.gridId, code: { in: focusCodes } },
    });
    const byCode = new Map(comps.map((c) => [c.code, c.nom]));
    focusNoms = focusCodes.map((c) => byCode.get(c) ?? c);
  }

  return (
    <SimChat
      sessionId={id}
      frameworkId={session.frameworkId}
      titre={scenario?.titre ?? "Entretien"}
      contexte={scenario?.contexte ?? ""}
      statut={session.statut}
      kind={session.kind}
      maxTurns={session.maxTurns ?? null}
      focusNoms={focusNoms}
      initialMessages={messages.map((m) => ({ role: m.role, content: m.content }))}
      initialDebrief={(session.debrief as unknown as Debrief) ?? null}
    />
  );
}
