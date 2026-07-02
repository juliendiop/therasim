// Données du tableau de bord d'accueil (« que faire aujourd'hui ? »).
// Tout reste scopé par référentiel (règle d'or §2.4) : on n'agrège jamais la
// maîtrise entre référentiels — seuls les compteurs d'activité sont globaux.

import { prisma } from "./prisma";
import { JOURS_OUBLI, joursDepuis } from "./mastery";
import { buildFrameworkDetail } from "./progress";
import { effectiveFrameworkIds } from "./entitlements";
import { listSimHistory, type SimHistoryItem } from "./sim-history";

export type DashboardData = {
  hasFrameworks: boolean;
  // Entretien / mini-scène laissé en cours (reprise en un clic).
  ongoingSim: {
    id: string;
    kind: string;
    scenarioTitre: string;
    frameworkNom: string;
    createdAt: Date;
  } | null;
  // Dernier référentiel pratiqué : le point de reprise naturel.
  reprendre: {
    frameworkId: string;
    frameworkNom: string;
    masteryMoyenne: number | null;
    couvertes: number;
    total: number;
    priorites: { competency_id: string; nom: string; raison: string }[];
  } | null;
  // Compétences pratiquées puis délaissées (> JOURS_OUBLI jours).
  aReviser: {
    frameworkId: string;
    frameworkNom: string;
    code: string;
    nom: string;
    jours: number;
  }[];
  // Activité des 7 derniers jours.
  semaine: { exercices: number; entretiens: number; competences: number };
  recentSims: SimHistoryItem[];
};

export async function buildDashboard(
  userId: string,
  tenantId: string,
  // Domaines débloqués individuellement au-delà du catalogue de la plateforme
  // (opt-in B2B « offres individuelles ») : à inclure dans les stats/reprise.
  extraFrameworkIds?: Set<string>,
): Promise<DashboardData> {
  const ids = await effectiveFrameworkIds(tenantId);
  if (extraFrameworkIds) for (const id of extraFrameworkIds) ids.add(id);
  const frameworks = await prisma.framework.findMany({
    where: { statut: "publie", id: { in: Array.from(ids) } },
  });
  const fwIds = frameworks.map((f) => f.id);
  const fwById = new Map(frameworks.map((f) => [f.id, f]));
  const semaineDepuis = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [ongoing, lastAttempt, states, exercices, parCompetence, entretiensSemaine, history] =
    await Promise.all([
      prisma.simSession.findFirst({
        where: { userId, statut: "en_cours", frameworkId: { in: fwIds } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.attempt.findFirst({
        where: { userId, frameworkId: { in: fwIds } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.userCompetencyState.findMany({
        where: { userId, frameworkId: { in: fwIds }, attempts: { gt: 0 } },
      }),
      prisma.attempt.count({
        where: { userId, frameworkId: { in: fwIds }, createdAt: { gte: semaineDepuis } },
      }),
      prisma.attempt.groupBy({
        by: ["frameworkId", "competencyId"],
        where: { userId, frameworkId: { in: fwIds }, createdAt: { gte: semaineDepuis } },
      }),
      prisma.simSession.count({
        where: {
          userId,
          statut: "terminee",
          frameworkId: { in: fwIds },
          endedAt: { gte: semaineDepuis },
        },
      }),
      listSimHistory(userId, 3),
    ]);

  // Entretien en cours (nom du cas + du référentiel).
  let ongoingSim: DashboardData["ongoingSim"] = null;
  if (ongoing) {
    const scenario = await prisma.scenario.findUnique({ where: { id: ongoing.scenarioId } });
    ongoingSim = {
      id: ongoing.id,
      kind: ongoing.kind,
      scenarioTitre: scenario?.titre ?? "Entretien",
      frameworkNom: fwById.get(ongoing.frameworkId)?.nom ?? ongoing.frameworkId,
      createdAt: ongoing.createdAt,
    };
  }

  // Point de reprise : le dernier référentiel pratiqué, avec ses priorités.
  let reprendre: DashboardData["reprendre"] = null;
  if (lastAttempt) {
    const detail = await buildFrameworkDetail(userId, lastAttempt.frameworkId);
    if (detail) {
      reprendre = {
        frameworkId: detail.framework.id,
        frameworkNom: detail.framework.nom,
        masteryMoyenne: detail.overall.masteryMoyenne,
        couvertes: detail.overall.competencesCouvertes,
        total: detail.overall.competencesTotal,
        priorites: detail.priorites.slice(0, 2),
      };
    }
  }

  // À réviser : pratiquée, mais plus touchée depuis > JOURS_OUBLI jours.
  const staleStates = states
    .filter((s) => joursDepuis(s.lastPracticed) > JOURS_OUBLI)
    .sort((a, b) => joursDepuis(b.lastPracticed) - joursDepuis(a.lastPracticed));
  const gridIds = [...new Set(frameworks.map((f) => f.gridId))];
  const competencies = await prisma.competency.findMany({
    where: { gridId: { in: gridIds } },
  });
  const nomParGrilleCode = new Map(competencies.map((c) => [`${c.gridId}:${c.code}`, c.nom]));
  const aReviser = staleStates.slice(0, 5).flatMap((s) => {
    const fw = fwById.get(s.frameworkId);
    if (!fw) return [];
    return [
      {
        frameworkId: s.frameworkId,
        frameworkNom: fw.nom,
        code: s.competencyId,
        nom: nomParGrilleCode.get(`${fw.gridId}:${s.competencyId}`) ?? s.competencyId,
        jours: Math.floor(joursDepuis(s.lastPracticed)),
      },
    ];
  });

  return {
    hasFrameworks: fwIds.length > 0,
    ongoingSim,
    reprendre,
    aReviser,
    semaine: {
      exercices,
      entretiens: entretiensSemaine,
      competences: parCompetence.length,
    },
    recentSims: history,
  };
}
