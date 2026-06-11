// Sessions live (évaluation animée par un formateur).
// Étude de cas = QCM tirés des compétences choisies, MULTI-RÉFÉRENTIEL.
// Cycle de vie : brouillon -> ouverte (sas d'attente) -> en_cours (chrono) -> fermee.

import { prisma } from "./prisma";
import { canManageLive } from "./roles";

export type Pair = { frameworkId: string; code: string };

export function roleCanManageLive(role: Parameters<typeof canManageLive>[0]): boolean {
  return canManageLive(role);
}

const MAX_QUESTIONS = 15;

/** QCM (reconnaissance) testant les paires {référentiel, compétence}. */
export async function buildQuestionSet(pairs: Pair[]): Promise<string[]> {
  const byFw = new Map<string, string[]>();
  for (const p of pairs) {
    const arr = byFw.get(p.frameworkId) ?? [];
    if (!arr.includes(p.code)) arr.push(p.code);
    byFw.set(p.frameworkId, arr);
  }

  const perFwLists: string[][] = [];
  for (const [frameworkId, codes] of byFw) {
    const drills = await prisma.drill.findMany({
      where: { frameworkId, mode: "reconnaissance", competencyId: { in: codes } },
      orderBy: { id: "asc" },
    });
    const byComp = new Map<string, string[]>();
    for (const d of drills) {
      const arr = byComp.get(d.competencyId) ?? [];
      if (arr.length < 2) arr.push(d.id);
      byComp.set(d.competencyId, arr);
    }
    const list: string[] = [];
    for (let i = 0; i < 2; i++) for (const code of codes) {
      const arr = byComp.get(code);
      if (arr && arr[i]) list.push(arr[i]);
    }
    perFwLists.push(list);
  }

  // Entrelace les référentiels, puis plafonne.
  const ids: string[] = [];
  let added = true;
  for (let i = 0; added; i++) {
    added = false;
    for (const list of perFwLists) {
      if (list[i]) {
        ids.push(list[i]);
        added = true;
      }
    }
  }
  return ids.slice(0, MAX_QUESTIONS);
}

export async function createLiveSession(input: {
  tenantId: string;
  createdBy: string;
  titre: string;
  pairs: Pair[];
  mode: "apprentissage" | "evaluation";
  durationMin: number;
}) {
  const drillIds = await buildQuestionSet(input.pairs);
  return prisma.liveSession.create({
    data: {
      tenantId: input.tenantId,
      createdBy: input.createdBy,
      titre: input.titre,
      pairs: input.pairs,
      frameworkId: input.pairs[0]?.frameworkId ?? null,
      competencies: Array.from(new Set(input.pairs.map((p) => p.code))),
      drillIds,
      mode: input.mode,
      durationMin: input.durationMin,
    },
  });
}

type SessionLite = {
  statut: string;
  closesAt: Date | null;
  pairs: unknown;
  frameworkId: string | null;
  competencies: unknown;
};

export function getSessionPairs(s: SessionLite): Pair[] {
  if (Array.isArray(s.pairs)) return s.pairs as Pair[];
  // Fallback legacy (sessions mono-référentiel d'avant le multi).
  if (s.frameworkId && Array.isArray(s.competencies)) {
    return (s.competencies as string[]).map((code) => ({ frameworkId: s.frameworkId!, code }));
  }
  return [];
}

// --- Cycle de vie ---------------------------------------------------------

/** Ouvre le sas : le lien est actif, les participants peuvent rejoindre et patienter. */
export async function openLive(id: string) {
  return prisma.liveSession.update({
    where: { id },
    data: { statut: "ouverte", opensAt: new Date(), closesAt: null, startedAt: null },
  });
}

/** Déclenche le compte à rebours (durée éventuellement ajustée). */
export async function startCountdown(id: string, durationMin?: number) {
  const s = await prisma.liveSession.findUnique({ where: { id } });
  if (!s) return null;
  const dur = durationMin && durationMin > 0 ? Math.min(180, durationMin) : s.durationMin;
  const now = new Date();
  return prisma.liveSession.update({
    where: { id },
    data: {
      statut: "en_cours",
      durationMin: dur,
      startedAt: now,
      closesAt: new Date(now.getTime() + dur * 60 * 1000),
    },
  });
}

export async function closeLiveSession(id: string) {
  return prisma.liveSession.update({ where: { id }, data: { statut: "fermee" } });
}

/** Les participants peuvent-ils rejoindre (sas ou en cours) ? */
export function canJoin(s: { statut: string }): boolean {
  return s.statut === "ouverte" || s.statut === "en_cours";
}

/** Le chrono tourne-t-il (réponses acceptées) ? */
export function isRunning(s: { statut: string; closesAt: Date | null }): boolean {
  if (s.statut !== "en_cours") return false;
  if (s.closesAt && s.closesAt < new Date()) return false;
  return true;
}

// --- Résultats ------------------------------------------------------------

export type LiveResults = {
  participantsCount: number;
  finishedCount: number;
  overallAvg: number | null;
  parCompetence: { key: string; nom: string; module: string; avg: number | null; count: number }[];
  parModule: { module: string; avg: number | null }[];
  individuels: {
    participantId: string;
    prenom: string;
    nom: string;
    score: number | null;
    repondu: number;
    total: number;
    finished: boolean;
  }[];
};

export async function getLiveResults(sessionId: string): Promise<LiveResults | null> {
  const session = await prisma.liveSession.findUnique({ where: { id: sessionId } });
  if (!session) return null;
  const pairs = getSessionPairs(session);
  const frameworkIds = Array.from(new Set(pairs.map((p) => p.frameworkId)));

  const [participants, answers, frameworks] = await Promise.all([
    prisma.liveParticipant.findMany({ where: { sessionId }, orderBy: { joinedAt: "asc" } }),
    prisma.liveAnswer.findMany({ where: { sessionId } }),
    prisma.framework.findMany({ where: { id: { in: frameworkIds } } }),
  ]);
  const gridByFw = new Map(frameworks.map((f) => [f.id, f.gridId]));
  const gridIds = Array.from(new Set(frameworks.map((f) => f.gridId)));
  const [comps, cats] = await Promise.all([
    prisma.competency.findMany({ where: { gridId: { in: gridIds } } }),
    prisma.category.findMany({ where: { gridId: { in: gridIds } } }),
  ]);
  const catNom = new Map(cats.map((c) => [`${c.gridId}:${c.code}`, c.nom]));
  const compInfo = new Map(
    comps.map((c) => [
      `${c.gridId}:${c.code}`,
      { nom: c.nom, module: catNom.get(`${c.gridId}:${c.categoryCode}`) ?? "—" },
    ]),
  );

  const total = (session.drillIds as string[]).length;
  const fwOf = (a: { frameworkId: string | null }) => a.frameworkId ?? session.frameworkId ?? "";
  const keyOf = (fw: string, code: string) => `${fw}::${code}`;

  // Collectif par compétence (= par paire).
  const parCompetence = pairs.map((p) => {
    const grid = gridByFw.get(p.frameworkId) ?? "";
    const info = compInfo.get(`${grid}:${p.code}`);
    const a = answers.filter((x) => fwOf(x) === p.frameworkId && x.competencyId === p.code);
    const avg = a.length ? a.reduce((s, x) => s + x.score, 0) / a.length : null;
    return {
      key: keyOf(p.frameworkId, p.code),
      nom: info?.nom ?? p.code,
      module: info?.module ?? "—",
      avg,
      count: a.length,
    };
  });

  // Collectif par catégorie/module.
  const moduleNames = Array.from(new Set(parCompetence.map((c) => c.module)));
  const parModule = moduleNames.map((module) => {
    const keys = new Set(parCompetence.filter((c) => c.module === module).map((c) => c.key));
    const a = answers.filter((x) => keys.has(keyOf(fwOf(x), x.competencyId)));
    const avg = a.length ? a.reduce((s, x) => s + x.score, 0) / a.length : null;
    return { module, avg };
  });

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
    parModule,
    individuels,
  };
}
