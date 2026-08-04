// Agrégats d'usage par utilisateur — brique commune à l'export contacts et à
// l'en-tête « fiche utilisateur » de /admin/activity (une seule implémentation,
// pas deux vues qui pourraient diverger).
//
// ⚠️ CONTENU CLINIQUE — INTERDICTION EXPLICITE : n'ajoutez JAMAIS ici les champs
// SimMessage.content (transcript complet patient/apprenant), SimSession.debrief /
// selfAssessment (citations, narrative), ou Attempt.raw (peut contenir une
// citation de la réponse de l'apprenant). Ce module ne doit renvoyer que des
// COMPTEURS et des DATES — jamais un texte produit par un praticien pendant une
// simulation. C'est exactement l'endroit où la tentation d'« enrichir un peu »
// serait la plus naturelle : ne le faites pas.
import "server-only";
import { prisma } from "./prisma";
import { computeSegment, type Segment } from "./segments";
import { segmentConfig } from "./segment-config";

export type UserStats = {
  n3Completed: number;
  n2Completed: number;
  drillsCount: number;
  lastActivityAt: Date | null;
  /** Référentiels distincts effectivement PRATIQUÉS (drill ou simulation/mini-scène). */
  frameworksWorked: string[];
  /** Référentiels distincts DÉBLOQUÉS (accès), qu'ils aient été pratiqués ou non. */
  frameworksUnlocked: string[];
  /** A déjà réclamé une invitation bêta (BetaInvite.status === 'CLAIMED'). */
  isBetaOrigin: boolean;
};

const EMPTY_STATS: UserStats = {
  n3Completed: 0,
  n2Completed: 0,
  drillsCount: 0,
  lastActivityAt: null,
  frameworksWorked: [],
  frameworksUnlocked: [],
  isBetaOrigin: false,
};

/** Calcule les agrégats d'usage pour un ensemble d'utilisateurs, en quelques
 *  requêtes groupées (pas une par utilisateur). */
export async function buildUserStatsMap(userIds: string[]): Promise<Map<string, UserStats>> {
  const map = new Map<string, UserStats>(userIds.map((id) => [id, { ...EMPTY_STATS }]));
  if (userIds.length === 0) return map;

  const [drills, sims, unlocks, betaClaims] = await Promise.all([
    prisma.attempt.findMany({
      where: { source: "drill", userId: { in: userIds } },
      select: { userId: true, frameworkId: true, createdAt: true },
    }),
    prisma.simSession.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, kind: true, statut: true, frameworkId: true, createdAt: true },
    }),
    prisma.userFrameworkAccess.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, frameworkId: true },
    }),
    prisma.betaInvite.findMany({
      where: { status: "CLAIMED", claimedByUserId: { in: userIds } },
      select: { claimedByUserId: true },
    }),
  ]);

  const frameworksWorked = new Map<string, Set<string>>();
  const frameworksUnlocked = new Map<string, Set<string>>();
  const touch = (setMap: Map<string, Set<string>>, userId: string, value: string) => {
    if (!setMap.has(userId)) setMap.set(userId, new Set());
    setMap.get(userId)!.add(value);
  };
  const bumpLastActivity = (s: UserStats, at: Date) => {
    if (!s.lastActivityAt || at > s.lastActivityAt) s.lastActivityAt = at;
  };

  for (const a of drills) {
    const s = map.get(a.userId);
    if (!s) continue;
    s.drillsCount++;
    bumpLastActivity(s, a.createdAt);
    touch(frameworksWorked, a.userId, a.frameworkId);
  }

  for (const sim of sims) {
    const s = map.get(sim.userId);
    if (!s) continue;
    bumpLastActivity(s, sim.createdAt);
    touch(frameworksWorked, sim.userId, sim.frameworkId);
    if (sim.statut === "terminee") {
      if (sim.kind === "simulation") s.n3Completed++;
      else if (sim.kind === "miniscene") s.n2Completed++;
    }
  }

  for (const u of unlocks) {
    touch(frameworksUnlocked, u.userId, u.frameworkId);
  }

  const betaOriginIds = new Set(
    betaClaims.map((b) => b.claimedByUserId).filter((v): v is string => Boolean(v)),
  );

  for (const [userId, s] of map) {
    s.frameworksWorked = Array.from(frameworksWorked.get(userId) ?? []).sort();
    s.frameworksUnlocked = Array.from(frameworksUnlocked.get(userId) ?? []).sort();
    s.isBetaOrigin = betaOriginIds.has(userId);
  }

  return map;
}

/** Segment calculé pour un ensemble d'utilisateurs (déjà chargés : createdAt +
 *  abonnement). Une seule lecture de la config de dormance pour tout le lot. */
export async function computeSegmentsForUsers(
  users: { id: string; createdAt: Date }[],
  subscriptionByUserId: Map<string, { status: string } | undefined>,
  statsByUserId: Map<string, UserStats>,
  now: Date = new Date(),
): Promise<Map<string, Segment>> {
  const dormantAfterDays = await segmentConfig.dormantAfterDays();
  const out = new Map<string, Segment>();
  for (const u of users) {
    const stats = statsByUserId.get(u.id) ?? EMPTY_STATS;
    const sub = subscriptionByUserId.get(u.id);
    out.set(
      u.id,
      computeSegment({
        createdAt: u.createdAt,
        hasCompletedActivation: stats.n3Completed > 0,
        isBetaOrigin: stats.isBetaOrigin,
        subscriptionStatus: sub?.status ?? null,
        lastActivityAt: stats.lastActivityAt,
        dormantAfterDays,
        now,
      }),
    );
  }
  return out;
}
