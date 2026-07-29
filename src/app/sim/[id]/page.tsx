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
  // Compétences réellement évaluées par le débrief (mêmes règles que endSimulation) :
  // les 2 ciblées en mini-scène, toute la grille en séance complète. Sert à l'auto-
  // évaluation ET à résoudre les noms dans l'affichage du débrief.
  let competencies: { code: string; nom: string }[] = [];
  if (framework) {
    const all = await prisma.competency.findMany({
      where: { gridId: framework.gridId },
      orderBy: { ordre: "asc" },
    });
    if (session.kind === "miniscene" && focusCodes.length > 0) {
      const byCode = new Map(all.map((c) => [c.code, c.nom]));
      focusNoms = focusCodes.map((c) => byCode.get(c) ?? c);
      competencies = all
        .filter((c) => focusCodes.includes(c.code))
        .map((c) => ({ code: c.code, nom: c.nom }));
    } else {
      competencies = all.map((c) => ({ code: c.code, nom: c.nom }));
    }
  }

  return (
    <SimChat
      sessionId={id}
      frameworkId={session.frameworkId}
      titre={scenario?.titre ?? "Séance"}
      contexte={scenario?.contexte ?? ""}
      statut={session.statut}
      kind={session.kind}
      maxTurns={session.maxTurns ?? null}
      focusNoms={focusNoms}
      competencies={competencies}
      initialMessages={messages.map((m) => ({ role: m.role, content: m.content }))}
      initialDebrief={(session.debrief as unknown as Debrief) ?? null}
      initialSelfAssessment={(session.selfAssessment as Record<string, number> | null) ?? null}
    />
  );
}
