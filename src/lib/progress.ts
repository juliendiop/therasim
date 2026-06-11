// Construction de la carte de progression — spec §5.6.
// Règle d'or (§2.4) : tout se calcule PAR référentiel. Jamais de moyenne globale
// entre référentiels. Le routage reste cantonné au référentiel en cours.

import { prisma } from "./prisma";
import {
  COUVERTURE_LABEL,
  PALIER_LABEL,
  couverture,
  joursDepuis,
  JOURS_OUBLI,
  palier,
} from "./mastery";
import { classerPriorites, raisonPriorite, type EtatCompetence } from "./routing";
import { effectiveFrameworkIds } from "./entitlements";

export type CompetenceVue = {
  id: string;
  nom: string;
  mastery: number | null;
  palier: string;
  attempts: number;
  couverture: string;
  aReviser: boolean;
  lastPracticed: string | null;
};

export type CategorieVue = {
  code: string;
  nom: string;
  competencies: CompetenceVue[];
};

export type OverallVue = {
  masteryMoyenne: number | null;
  competencesCouvertes: number;
  competencesTotal: number;
  niveau: string;
};

// Charge la grille d'un référentiel + l'état utilisateur, et fusionne les deux.
async function chargerEtats(userId: string, frameworkId: string, gridId: string) {
  const [competencies, categories, states] = await Promise.all([
    prisma.competency.findMany({ where: { gridId }, orderBy: { ordre: "asc" } }),
    prisma.category.findMany({ where: { gridId }, orderBy: { ordre: "asc" } }),
    prisma.userCompetencyState.findMany({ where: { userId, frameworkId } }),
  ]);

  const stateByCode = new Map(states.map((s) => [s.competencyId, s]));

  const enriched = competencies.map((c) => {
    const st = stateByCode.get(c.code);
    const mastery = st?.mastery ?? null;
    const attempts = st?.attempts ?? 0;
    const last = st?.lastPracticed ?? null;
    return {
      competency: c,
      mastery,
      attempts,
      lastPracticed: last,
      aReviser: attempts > 0 && joursDepuis(last) > JOURS_OUBLI,
    };
  });

  return { enriched, categories };
}

function calcOverall(
  enriched: { mastery: number | null; attempts: number }[],
): OverallVue {
  const avec = enriched.filter((e) => e.mastery !== null) as { mastery: number }[];
  const masteryMoyenne =
    avec.length > 0 ? avec.reduce((s, e) => s + e.mastery, 0) / avec.length : null;
  const competencesCouvertes = enriched.filter((e) => e.attempts > 0).length;
  return {
    masteryMoyenne,
    competencesCouvertes,
    competencesTotal: enriched.length,
    // Niveau : N1 par défaut. La progression recommandée vers N2/N3 (spec §5.4)
    // est une recommandation pédagogique, pas un verrou (backlog mini-scènes N2).
    niveau: "N1",
  };
}

/** Vue d'ensemble : un profil par référentiel publié ET accordé au tenant (§5.6). */
export async function buildOverview(userId: string, tenantId: string) {
  const ids = await effectiveFrameworkIds(tenantId);
  const frameworks = await prisma.framework.findMany({
    where: { statut: "publie", id: { in: Array.from(ids) } },
    orderBy: { nom: "asc" },
  });

  const items = await Promise.all(
    frameworks.map(async (f) => {
      const { enriched } = await chargerEtats(userId, f.id, f.gridId);
      const overall = calcOverall(enriched);
      return {
        id: f.id,
        nom: f.nom,
        type: f.type,
        description: f.description,
        mastery_moyenne: overall.masteryMoyenne,
        competences_couvertes: overall.competencesCouvertes,
        competences_total: overall.competencesTotal,
        niveau: overall.niveau,
      };
    }),
  );

  return { frameworks: items };
}

/** Carte détaillée d'un référentiel (GET /api/me/progress/{framework_id}). */
export async function buildFrameworkDetail(userId: string, frameworkId: string) {
  const framework = await prisma.framework.findUnique({ where: { id: frameworkId } });
  if (!framework) return null;

  const { enriched, categories } = await chargerEtats(
    userId,
    framework.id,
    framework.gridId,
  );

  // Regroupement par catégorie.
  const catByCode = new Map(categories.map((c) => [c.code, c]));
  const groupes = new Map<string, CompetenceVue[]>();
  for (const e of enriched) {
    const vue: CompetenceVue = {
      id: e.competency.code,
      nom: e.competency.nom,
      mastery: e.mastery,
      palier: PALIER_LABEL[palier(e.mastery)],
      attempts: e.attempts,
      couverture: COUVERTURE_LABEL[couverture(e.attempts)],
      aReviser: e.aReviser,
      lastPracticed: e.lastPracticed ? e.lastPracticed.toISOString() : null,
    };
    const code = e.competency.categoryCode;
    if (!groupes.has(code)) groupes.set(code, []);
    groupes.get(code)!.push(vue);
  }

  const categoriesVue: CategorieVue[] = categories
    .filter((c) => groupes.has(c.code))
    .map((c) => ({
      code: c.code,
      nom: c.nom,
      competencies: groupes.get(c.code)!,
    }));

  // Priorités (scopées au référentiel).
  const etats: EtatCompetence[] = enriched.map((e) => ({
    competencyId: e.competency.code,
    mastery: e.mastery,
    attempts: e.attempts,
    lastPracticed: e.lastPracticed,
  }));
  const nomByCode = new Map(enriched.map((e) => [e.competency.code, e.competency.nom]));
  const priorites = classerPriorites(etats)
    .slice(0, 3)
    .map((e) => ({
      competency_id: e.competencyId,
      nom: nomByCode.get(e.competencyId) ?? e.competencyId,
      raison: raisonPriorite(e),
    }));

  return {
    framework: { id: framework.id, nom: framework.nom, type: framework.type },
    overall: calcOverall(enriched),
    categories: categoriesVue,
    priorites,
  };
}
