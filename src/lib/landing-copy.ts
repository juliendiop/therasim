// Données de la page d'accueil dérivées du CATALOGUE (jamais codées en dur) :
//  1. les spécialités les mieux fournies en cas jouables — citées dans le hero et
//     la meta description, pour que la promesse reste vraie quand le catalogue bouge ;
//  2. trois exercices de démonstration, tirés de trois domaines DISTINCTS.
//
// Même cache que le catalogue (tag `catalogue`, invalidé à l'édition en admin).
// ⚠️ `unstable_cache` sérialise sa valeur de retour : ne jamais y faire transiter
// de `Date` (voir src/lib/catalogue.ts).
import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import { CATALOGUE_TAG } from "./catalogue";

const DAY = 86400;

// --- Spécialités les mieux fournies ----------------------------------------

export type SpecialiteRichesse = { nom: string; slug: string; casCount: number };

const cachedSpecialitesParRichesse = unstable_cache(
  async (): Promise<SpecialiteRichesse[]> => {
    const fws = await prisma.framework.findMany({
      where: { statut: "publie", nature: "specialite" },
      select: { id: true, nom: true, slug: true },
    });
    if (fws.length === 0) return [];
    const cas = await prisma.scenario.groupBy({
      by: ["frameworkId"],
      where: { frameworkId: { in: fws.map((f) => f.id) } },
      _count: true,
    });
    const byFw = new Map(cas.map((r) => [r.frameworkId, r._count]));
    return (
      fws
        .map((f) => ({ nom: f.nom, slug: f.slug, casCount: byFw.get(f.id) ?? 0 }))
        // « Cas jouables » : un référentiel sans scénario n'a rien à proposer.
        .filter((f) => f.casCount > 0)
        // Tri déterministe : à nombre de cas égal, ordre alphabétique — sinon la
        // phrase du hero changerait d'un rendu à l'autre.
        .sort((a, b) => b.casCount - a.casCount || a.nom.localeCompare(b.nom, "fr"))
    );
  },
  ["landing-specialites-par-richesse"],
  { revalidate: DAY, tags: [CATALOGUE_TAG] },
);

/**
 * Noms des `limit` spécialités les mieux fournies en cas, telles qu'elles sont
 * nommées en base. Aucun alias codé en dur : ce qui est affiché est ce qui existe.
 */
export async function specialitesPhares(limit = 4): Promise<string[]> {
  const rows = await cachedSpecialitesParRichesse();
  return rows.slice(0, limit).map((r) => r.nom);
}

/** Énumération française : « a, b, c et d ». Chaîne vide si la liste est vide. */
export function enumereFr(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`;
}

// --- Exercices de démonstration --------------------------------------------

export type DemoOption = { text: string; is_best: boolean; score: number; feedback: string };

export type DemoDrillView = {
  id: string;
  domaine: string; // nom public du référentiel
  domaineSlug: string;
  competence: string;
  rappel: string;
  stimulus: string;
  options: DemoOption[];
  modele: string;
  reactionSiBon: string | null;
};

/** Valide le JSON `options` d'un drill : on n'affiche que du contenu exploitable. */
function parseOptions(raw: unknown): DemoOption[] | null {
  if (!Array.isArray(raw)) return null;
  const out: DemoOption[] = [];
  for (const o of raw) {
    if (typeof o !== "object" || o === null) return null;
    const { text, is_best, score, feedback } = o as Record<string, unknown>;
    if (typeof text !== "string" || typeof feedback !== "string") return null;
    if (typeof score !== "number") return null;
    out.push({ text, is_best: Boolean(is_best), score, feedback });
  }
  // Un QCM a besoin d'au moins deux options, dont une bonne réponse.
  if (out.length < 2 || !out.some((o) => o.is_best)) return null;
  return out;
}

const cachedDemoDrills = unstable_cache(
  async (): Promise<DemoDrillView[]> => {
    const fws = await prisma.framework.findMany({
      where: { statut: "publie" },
      select: { id: true, nom: true, slug: true, type: true, nature: true, gridId: true },
      orderBy: { id: "asc" }, // sélection déterministe
    });
    if (fws.length === 0) return [];

    // Un exemple par grande famille de contenu, pour montrer l'étendue du produit :
    // une approche, une situation clinique, un référentiel du socle.
    const familles = [
      (f: (typeof fws)[number]) => f.nature === "specialite" && f.type === "approche",
      (f: (typeof fws)[number]) => f.nature === "specialite" && f.type === "situation",
      (f: (typeof fws)[number]) => f.nature === "socle",
    ];
    const retenus: typeof fws = [];
    for (const match of familles) {
      const fw = fws.find((f) => match(f) && !retenus.some((r) => r.id === f.id));
      if (fw) retenus.push(fw);
    }
    // Catalogue atypique (pas de situation publiée, par ex.) : on complète avec
    // n'importe quel autre domaine plutôt que d'afficher une démo tronquée.
    for (const fw of fws) {
      if (retenus.length >= 3) break;
      if (!retenus.some((r) => r.id === fw.id)) retenus.push(fw);
    }
    if (retenus.length === 0) return [];

    const [drills, competencies] = await Promise.all([
      prisma.drill.findMany({
        where: { mode: "reconnaissance", frameworkId: { in: retenus.map((f) => f.id) } },
        select: {
          id: true,
          frameworkId: true,
          competencyId: true,
          rappelTheorique: true,
          stimulus: true,
          options: true,
          modeleReponse: true,
          patientReactionSiBon: true,
        },
        orderBy: [{ difficulty: "asc" }, { id: "asc" }],
      }),
      prisma.competency.findMany({
        where: { gridId: { in: [...new Set(retenus.map((f) => f.gridId))] } },
        select: { gridId: true, code: true, nom: true },
      }),
    ]);
    const compName = new Map(competencies.map((c) => [`${c.gridId}::${c.code}`, c.nom]));

    const vues: DemoDrillView[] = [];
    for (const fw of retenus) {
      const candidats = drills.filter(
        (d) => d.frameworkId === fw.id && parseOptions(d.options) !== null,
      );
      // Une réaction du patient rend la démo bien plus parlante : on la privilégie.
      const drill = candidats.find((d) => d.patientReactionSiBon) ?? candidats[0];
      if (!drill) continue;
      const options = parseOptions(drill.options);
      if (!options) continue;
      vues.push({
        id: drill.id,
        domaine: fw.nom,
        domaineSlug: fw.slug,
        competence: compName.get(`${fw.gridId}::${drill.competencyId}`) ?? drill.competencyId,
        rappel: drill.rappelTheorique,
        stimulus: drill.stimulus,
        options,
        modele: drill.modeleReponse,
        reactionSiBon: drill.patientReactionSiBon,
      });
    }
    return vues;
  },
  ["landing-demo-drills"],
  { revalidate: DAY, tags: [CATALOGUE_TAG] },
);

/** Trois exercices jouables sans compte, sur trois domaines distincts. */
export async function demoDrills(): Promise<DemoDrillView[]> {
  return cachedDemoDrills();
}

// --- Forfait de référence (exemple chiffré ambassadeur) ---------------------

export type PlanReference = { label: string; prixEuros: number };

/**
 * Forfait servant d'illustration dans l'exemple de revenu ambassadeur : le forfait
 * PAYANT MÉDIAN parmi les forfaits actifs. Choix déterministe et lu en base — jamais
 * un prix codé en dur, et l'exemple suit automatiquement la grille tarifaire.
 * `null` si aucun forfait payant n'est actif (l'exemple est alors masqué).
 */
export async function planDeReference(): Promise<PlanReference | null> {
  const plans = await prisma.subscriptionPlan.findMany({
    where: { active: true, priceEurCents: { gt: 0 } },
    orderBy: [{ priceEurCents: "asc" }, { ordre: "asc" }],
    select: { label: true, priceEurCents: true },
  });
  if (plans.length === 0) return null;
  const median = plans[Math.floor((plans.length - 1) / 2)];
  return { label: median.label, prixEuros: median.priceEurCents / 100 };
}
