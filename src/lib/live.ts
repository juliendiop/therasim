// Sessions live (évaluation animée par un formateur).
// Étude de cas = un jeu de QCM (reconnaissance) figé à la création, identique pour tous.
// Participants anonymes (prénom/nom), pas de compte. Résultats agrégés par session.

import { prisma } from "./prisma";
import type { Role } from "./auth";

export function roleCanManageLive(role: Role): boolean {
  return role === "super_admin" || role === "tenant_admin";
}

/** Sélectionne les QCM testant les compétences choisies (jusqu'à 2 par compétence). */
export async function buildQuestionSet(
  frameworkId: string,
  competencyCodes: string[],
): Promise<string[]> {
  const drills = await prisma.drill.findMany({
    where: {
      frameworkId,
      mode: "reconnaissance",
      competencyId: { in: competencyCodes },
    },
    orderBy: { id: "asc" },
  });
  const byComp = new Map<string, string[]>();
  for (const d of drills) {
    const arr = byComp.get(d.competencyId) ?? [];
    if (arr.length < 2) arr.push(d.id);
    byComp.set(d.competencyId, arr);
  }
  // Entrelace les compétences (un tour de chaque, puis le second).
  const ids: string[] = [];
  for (let i = 0; i < 2; i++) {
    for (const code of competencyCodes) {
      const arr = byComp.get(code);
      if (arr && arr[i]) ids.push(arr[i]);
    }
  }
  return ids;
}

export async function createLiveSession(input: {
  tenantId: string;
  createdBy: string;
  titre: string;
  frameworkId: string;
  competencies: string[];
  mode: "apprentissage" | "evaluation";
  durationMin: number;
}) {
  const drillIds = await buildQuestionSet(input.frameworkId, input.competencies);
  return prisma.liveSession.create({
    data: {
      tenantId: input.tenantId,
      createdBy: input.createdBy,
      titre: input.titre,
      frameworkId: input.frameworkId,
      competencies: input.competencies,
      drillIds,
      mode: input.mode,
      durationMin: input.durationMin,
    },
  });
}

export async function startLiveSession(id: string) {
  const s = await prisma.liveSession.findUnique({ where: { id } });
  if (!s) return null;
  const now = new Date();
  return prisma.liveSession.update({
    where: { id },
    data: {
      statut: "ouverte",
      opensAt: now,
      closesAt: new Date(now.getTime() + s.durationMin * 60 * 1000),
    },
  });
}

export async function closeLiveSession(id: string) {
  return prisma.liveSession.update({
    where: { id },
    data: { statut: "fermee" },
  });
}

/** Une session est-elle encore ouverte aux réponses ? */
export function isLiveOpen(s: {
  statut: string;
  closesAt: Date | null;
}): boolean {
  if (s.statut !== "ouverte") return false;
  if (s.closesAt && s.closesAt < new Date()) return false;
  return true;
}

export type LiveResults = {
  participantsCount: number;
  finishedCount: number;
  overallAvg: number | null; // 0..1
  parCompetence: { competencyId: string; nom: string; avg: number | null; count: number }[];
  individuels: {
    participantId: string;
    prenom: string;
    nom: string;
    score: number | null; // 0..1
    repondu: number;
    total: number;
    finished: boolean;
  }[];
};

/** Synthèse collective + résultats individuels d'une session. */
export async function getLiveResults(sessionId: string): Promise<LiveResults | null> {
  const session = await prisma.liveSession.findUnique({ where: { id: sessionId } });
  if (!session) return null;
  const framework = await prisma.framework.findUnique({
    where: { id: session.frameworkId },
  });

  const [participants, answers, comps] = await Promise.all([
    prisma.liveParticipant.findMany({
      where: { sessionId },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.liveAnswer.findMany({ where: { sessionId } }),
    framework
      ? prisma.competency.findMany({ where: { gridId: framework.gridId } })
      : Promise.resolve([]),
  ]);

  const total = (session.drillIds as string[]).length;
  const nomByCode = new Map(comps.map((c) => [c.code, c.nom]));
  const competencyCodes = session.competencies as string[];

  // Collectif par compétence.
  const parCompetence = competencyCodes.map((code) => {
    const a = answers.filter((x) => x.competencyId === code);
    const avg = a.length ? a.reduce((s, x) => s + x.score, 0) / a.length : null;
    return { competencyId: code, nom: nomByCode.get(code) ?? code, avg, count: a.length };
  });

  // Individuels.
  const answersByPart = new Map<string, typeof answers>();
  for (const a of answers) {
    const arr = answersByPart.get(a.participantId) ?? [];
    arr.push(a);
    answersByPart.set(a.participantId, arr);
  }
  const individuels = participants.map((p) => {
    const a = answersByPart.get(p.id) ?? [];
    const score = a.length ? a.reduce((s, x) => s + x.score, 0) / a.length : null;
    return {
      participantId: p.id,
      prenom: p.prenom,
      nom: p.nom,
      score,
      repondu: a.length,
      total,
      finished: Boolean(p.finishedAt),
    };
  });

  const overallAvg = answers.length
    ? answers.reduce((s, x) => s + x.score, 0) / answers.length
    : null;

  return {
    participantsCount: participants.length,
    finishedCount: participants.filter((p) => p.finishedAt).length,
    overallAvg,
    parCompetence,
    individuels,
  };
}
