// Sélection du drill recommandé dans un référentiel (spec §4.4 / §5.4).
// Assemble l'état utilisateur + les drills disponibles, applique le routage.

import { prisma } from "./prisma";
import {
  choisirDrill,
  classerPriorites,
  type EtatCompetence,
} from "./routing";

/** Codes des N compétences prioritaires d'un référentiel (pour cibler une mini-scène N2). */
export async function topPriorityCodes(
  userId: string,
  frameworkId: string,
  n: number,
): Promise<string[]> {
  const framework = await prisma.framework.findUnique({ where: { id: frameworkId } });
  if (!framework) return [];
  const [competencies, states] = await Promise.all([
    prisma.competency.findMany({ where: { gridId: framework.gridId }, orderBy: { ordre: "asc" } }),
    prisma.userCompetencyState.findMany({ where: { userId, frameworkId } }),
  ]);
  const byCode = new Map(states.map((s) => [s.competencyId, s]));
  const etats: EtatCompetence[] = competencies.map((c) => {
    const st = byCode.get(c.code);
    return {
      competencyId: c.code,
      mastery: st?.mastery ?? null,
      attempts: st?.attempts ?? 0,
      lastPracticed: st?.lastPracticed ?? null,
    };
  });
  return classerPriorites(etats)
    .slice(0, n)
    .map((e) => e.competencyId);
}

type NextDrillResult =
  | { drillId: string; competencyId: string }
  | { drillId: null; reason: string };

export async function getNextDrill(
  userId: string,
  frameworkId: string,
  competencyCode?: string,
): Promise<NextDrillResult> {
  const framework = await prisma.framework.findUnique({ where: { id: frameworkId } });
  if (!framework) return { drillId: null, reason: "référentiel introuvable" };

  const [competencies, states, drills] = await Promise.all([
    prisma.competency.findMany({ where: { gridId: framework.gridId } }),
    prisma.userCompetencyState.findMany({ where: { userId, frameworkId } }),
    prisma.drill.findMany({ where: { frameworkId } }),
  ]);

  const stateByCode = new Map(states.map((s) => [s.competencyId, s]));
  const drillsByCompetency = new Map<string, typeof drills>();
  for (const d of drills) {
    if (!drillsByCompetency.has(d.competencyId)) drillsByCompetency.set(d.competencyId, []);
    drillsByCompetency.get(d.competencyId)!.push(d);
  }

  const etat = (code: string): EtatCompetence => {
    const st = stateByCode.get(code);
    return {
      competencyId: code,
      mastery: st?.mastery ?? null,
      attempts: st?.attempts ?? 0,
      lastPracticed: st?.lastPracticed ?? null,
    };
  };

  // Cas ciblé : un bouton "s'entraîner" sur une compétence précise.
  if (competencyCode) {
    const candidats = drillsByCompetency.get(competencyCode) ?? [];
    const choisi = choisirDrill(etat(competencyCode), candidats);
    return choisi
      ? { drillId: choisi.id, competencyId: competencyCode }
      : { drillId: null, reason: "aucun drill pour cette compétence" };
  }

  // Cas général : compétences triées par priorité, on prend la 1re qui a un drill.
  const etats = competencies.map((c) => etat(c.code));
  for (const e of classerPriorites(etats)) {
    const candidats = drillsByCompetency.get(e.competencyId) ?? [];
    const choisi = choisirDrill(e, candidats);
    if (choisi) return { drillId: choisi.id, competencyId: e.competencyId };
  }

  return { drillId: null, reason: "aucun drill disponible dans ce référentiel" };
}
