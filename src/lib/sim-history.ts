// Historique des mises en situation (mini-scènes N2 + séances complètes N3).
// Enrichit les SimSession de l'utilisateur : cas, référentiel, tours, note moyenne.

import { prisma } from "./prisma";
import type { Debrief } from "./simulator";

export type SimHistoryItem = {
  id: string;
  kind: string; // 'simulation' | 'miniscene'
  statut: string; // 'en_cours' | 'terminee'
  scenarioTitre: string;
  frameworkId: string;
  frameworkNom: string;
  createdAt: Date;
  endedAt: Date | null;
  tours: number; // répliques de l'apprenant
  moyenne: number | null; // moyenne des notes 1..5 du débrief (compétences évaluées)
};

/** Moyenne des notes du débrief (1..5), sur les compétences réellement évaluées. */
export function debriefMoyenne(debrief: unknown): number | null {
  const d = debrief as Partial<Debrief> | null;
  if (!d || !Array.isArray(d.scores)) return null;
  const notes = d.scores
    .filter((s) => !s.non_evalue && Number.isFinite(Number(s.note)))
    .map((s) => Number(s.note));
  if (notes.length === 0) return null;
  return notes.reduce((a, b) => a + b, 0) / notes.length;
}

export async function listSimHistory(userId: string, take = 50): Promise<SimHistoryItem[]> {
  const sessions = await prisma.simSession.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
  if (sessions.length === 0) return [];

  const scenarioIds = [...new Set(sessions.map((s) => s.scenarioId))];
  const frameworkIds = [...new Set(sessions.map((s) => s.frameworkId))];
  const sessionIds = sessions.map((s) => s.id);

  const [scenarios, frameworks, tours] = await Promise.all([
    prisma.scenario.findMany({ where: { id: { in: scenarioIds } } }),
    prisma.framework.findMany({ where: { id: { in: frameworkIds } } }),
    prisma.simMessage.groupBy({
      by: ["sessionId"],
      where: { sessionId: { in: sessionIds }, role: "apprenant" },
      _count: { _all: true },
    }),
  ]);

  const scenarioById = new Map(scenarios.map((s) => [s.id, s.titre]));
  const frameworkById = new Map(frameworks.map((f) => [f.id, f.nom]));
  const toursBySession = new Map(tours.map((t) => [t.sessionId, t._count._all]));

  return sessions.map((s) => ({
    id: s.id,
    kind: s.kind,
    statut: s.statut,
    scenarioTitre: scenarioById.get(s.scenarioId) ?? "Séance",
    frameworkId: s.frameworkId,
    frameworkNom: frameworkById.get(s.frameworkId) ?? s.frameworkId,
    createdAt: s.createdAt,
    endedAt: s.endedAt,
    tours: toursBySession.get(s.id) ?? 0,
    moyenne: debriefMoyenne(s.debrief),
  }));
}
