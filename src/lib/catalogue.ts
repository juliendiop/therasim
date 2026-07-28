// Données PUBLIQUES du catalogue de référentiels (pages /domaines, section accueil,
// sitemap, liens de blog). Tout est dérivé de la base : ajouter/publier un référentiel
// le fait apparaître sans toucher au code. N'expose JAMAIS le contenu des drills
// (options, bonnes réponses, modèle de réponse) ni les ancrages de notation 1/3.
//
// CACHE : le layout racine lit le cookie de session -> les pages sont rendues
// dynamiquement. Pour éviter un hit DB à CHAQUE requête de crawler, les lectures sont
// mémoïsées via `unstable_cache` (24 h) sous le tag `catalogue`, invalidé à chaque
// édition de contenu en admin (voir revalidateTag).
import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";

/** Tag d'invalidation du cache catalogue (appeler revalidateTag après édition admin). */
export const CATALOGUE_TAG = "catalogue";
const DAY = 86400;

export type DomaineCard = {
  id: string;
  slug: string;
  nom: string;
  type: string; // 'approche' | 'transversale' | 'situation'
  nature: string; // 'socle' | 'specialite'
  description: string | null; // introPublique en repli sur description (court, pour la carte)
  competencyCount: number;
  casCount: number;
};

export type PublicCatalogue = {
  socle: DomaineCard[];
  specialites: DomaineCard[];
  // Cadrage tarifaire : nb de spécialités par niveau, LU depuis la base (jamais en dur).
  plans: { label: string; quota: number | null }[];
};

/** Compteurs (compétences par grille, cas par référentiel) en 2 agrégations, sans N+1. */
async function buildCards(
  frameworks: {
    id: string;
    slug: string | null;
    nom: string;
    type: string;
    nature: string;
    description: string | null;
    introPublique: string | null;
    gridId: string;
  }[],
): Promise<DomaineCard[]> {
  if (frameworks.length === 0) return [];
  const gridIds = [...new Set(frameworks.map((f) => f.gridId))];
  const ids = frameworks.map((f) => f.id);
  const [compByGrid, casByFw] = await Promise.all([
    prisma.competency.groupBy({ by: ["gridId"], where: { gridId: { in: gridIds } }, _count: true }),
    prisma.scenario.groupBy({ by: ["frameworkId"], where: { frameworkId: { in: ids } }, _count: true }),
  ]);
  const comp = new Map(compByGrid.map((r) => [r.gridId, r._count]));
  const cas = new Map(casByFw.map((r) => [r.frameworkId, r._count]));
  return frameworks.map((f) => ({
    id: f.id,
    slug: f.slug ?? f.id,
    nom: f.nom,
    type: f.type,
    nature: f.nature,
    description: f.introPublique ?? f.description,
    competencyCount: comp.get(f.gridId) ?? 0,
    casCount: cas.get(f.id) ?? 0,
  }));
}

/** Catalogue public : socle et spécialités publiés + cadrage des quotas par forfait. */
export const getPublicCatalogue = unstable_cache(
  async (): Promise<PublicCatalogue> => {
    const [frameworks, plans] = await Promise.all([
      prisma.framework.findMany({
        where: { statut: "publie" },
        orderBy: [{ nature: "asc" }, { nom: "asc" }],
      }),
      prisma.subscriptionPlan.findMany({
        where: { active: true },
        orderBy: [{ priceEurCents: "asc" }, { ordre: "asc" }],
        select: { label: true, frameworkQuota: true },
      }),
    ]);
    const cards = await buildCards(frameworks);
    return {
      socle: cards.filter((c) => c.nature === "socle"),
      specialites: cards.filter((c) => c.nature !== "socle"),
      plans: plans.map((p) => ({ label: p.label, quota: p.frameworkQuota })),
    };
  },
  ["public-catalogue"],
  { revalidate: DAY, tags: [CATALOGUE_TAG] },
);

export type DomaineCompetency = { code: string; nom: string; description: string | null };
export type DomaineCategory = { code: string; nom: string; competencies: DomaineCompetency[] };

export type DomaineDetail = {
  id: string;
  slug: string;
  nom: string;
  type: string;
  nature: string;
  intro: string | null; // introPublique, repli description
  auteurs: string | null;
  cadreReference: string | null;
  competencyCount: number;
  casCount: number;
  categories: DomaineCategory[];
  exempleCas: { titre: string; contexte: string | null } | null;
  // Timestamp (ms), pas un `Date` : la valeur passe par `unstable_cache`, qui la
  // sérialise — un `Date` ressortirait en chaîne au hit suivant.
  lastModifiedMs: number;
};

/** Un référentiel PUBLIÉ par son slug public. `null` si inconnu ou non publié. */
export const getPublicDomaine = unstable_cache(
  async (slug: string): Promise<DomaineDetail | null> => {
    const framework = await prisma.framework.findFirst({ where: { slug, statut: "publie" } });
    if (!framework) return null;

    const [categories, competencies, exemple, compAgg, casAgg, casCount] = await Promise.all([
      prisma.category.findMany({ where: { gridId: framework.gridId }, orderBy: { ordre: "asc" } }),
      prisma.competency.findMany({ where: { gridId: framework.gridId }, orderBy: { ordre: "asc" } }),
      prisma.scenario.findFirst({ where: { frameworkId: framework.id }, orderBy: { id: "asc" } }),
      prisma.competency.aggregate({ where: { gridId: framework.gridId }, _max: { updatedAt: true } }),
      prisma.scenario.aggregate({ where: { frameworkId: framework.id }, _max: { updatedAt: true } }),
      prisma.scenario.count({ where: { frameworkId: framework.id } }),
    ]);

    // Description publique d'une compétence : sa `description` si présente, sinon l'ancrage
    // de MAÎTRISE (ancrage5) = « ce que fait quelqu'un qui la maîtrise ». Jamais 1/3 (barème).
    const byCat = new Map<string, DomaineCompetency[]>();
    for (const c of competencies) {
      const arr = byCat.get(c.categoryCode) ?? [];
      arr.push({ code: c.code, nom: c.nom, description: c.description ?? c.ancrage5 ?? null });
      byCat.set(c.categoryCode, arr);
    }
    const cats: DomaineCategory[] = categories
      .map((cat) => ({ code: cat.code, nom: cat.nom, competencies: byCat.get(cat.code) ?? [] }))
      .filter((cat) => cat.competencies.length > 0);

    const lastModifiedMs = Math.max(
      framework.updatedAt.getTime(),
      compAgg._max.updatedAt?.getTime() ?? 0,
      casAgg._max.updatedAt?.getTime() ?? 0,
    );

    return {
      id: framework.id,
      slug: framework.slug ?? framework.id,
      nom: framework.nom,
      type: framework.type,
      nature: framework.nature,
      intro: framework.introPublique ?? framework.description,
      auteurs: framework.auteurs,
      cadreReference: framework.cadreReference,
      competencyCount: competencies.length,
      casCount,
      categories: cats,
      exempleCas: exemple ? { titre: exemple.titre, contexte: exemple.contexte } : null,
      lastModifiedMs,
    };
  },
  ["public-domaine"],
  { revalidate: DAY, tags: [CATALOGUE_TAG] },
);

/**
 * Slugs des référentiels publiés + lastmod RÉEL = max(framework, compétences, cas).
 * Pour generateStaticParams et le sitemap. Agrégations groupées (pas de N+1).
 *
 * ⚠️ Renvoie des timestamps (millisecondes), PAS des `Date` : `unstable_cache`
 * sérialise sa valeur de retour, donc un `Date` mis en cache ressort en chaîne au
 * hit suivant. Voir `publishedDomaineSlugs` juste en dessous, qui reconstruit les
 * `Date` HORS du cache.
 */
const cachedDomaineSlugs = unstable_cache(
  async (): Promise<{ slug: string; lastModifiedMs: number }[]> => {
    const fws = await prisma.framework.findMany({
      where: { statut: "publie" },
      select: { id: true, slug: true, gridId: true, updatedAt: true },
    });
    if (fws.length === 0) return [];
    const gridIds = [...new Set(fws.map((f) => f.gridId))];
    const ids = fws.map((f) => f.id);
    const [compMax, casMax] = await Promise.all([
      prisma.competency.groupBy({ by: ["gridId"], where: { gridId: { in: gridIds } }, _max: { updatedAt: true } }),
      prisma.scenario.groupBy({ by: ["frameworkId"], where: { frameworkId: { in: ids } }, _max: { updatedAt: true } }),
    ]);
    const cMap = new Map(compMax.map((r) => [r.gridId, r._max.updatedAt?.getTime() ?? 0]));
    const sMap = new Map(casMax.map((r) => [r.frameworkId, r._max.updatedAt?.getTime() ?? 0]));
    return fws.map((f) => ({
      slug: f.slug ?? f.id,
      lastModifiedMs: Math.max(
        f.updatedAt.getTime(),
        cMap.get(f.gridId) ?? 0,
        sMap.get(f.id) ?? 0,
      ),
    }));
  },
  ["published-domaine-slugs"],
  { revalidate: DAY, tags: [CATALOGUE_TAG] },
);

/** Idem, avec des `Date` reconstruites hors du cache (sûres à manipuler). */
export async function publishedDomaineSlugs(): Promise<
  { slug: string; lastModified: Date }[]
> {
  const rows = await cachedDomaineSlugs();
  return rows.map((r) => ({ slug: r.slug, lastModified: new Date(r.lastModifiedMs) }));
}

/**
 * Résout un paramètre d'URL vers un référentiel publié. Sert à la route [slug] pour
 * rediriger (301) un ancien lien /domaines/<id> vers /domaines/<slug>.
 */
export const resolveDomaineParam = unstable_cache(
  async (param: string): Promise<{ slug: string; matchedBy: "slug" | "id" } | null> => {
    const fw = await prisma.framework.findFirst({
      where: { statut: "publie", OR: [{ slug: param }, { id: param }] },
      select: { id: true, slug: true },
    });
    if (!fw) return null;
    const slug = fw.slug ?? fw.id;
    return { slug, matchedBy: slug === param ? "slug" : "id" };
  },
  ["resolve-domaine-param"],
  { revalidate: DAY, tags: [CATALOGUE_TAG] },
);

/**
 * Résout un référentiel pour un lien de blog (composant MDX + frontmatter). Accepte l'id
 * technique OU le slug public. Renvoie null si inconnu ou non publié → le composant se
 * dégrade en texte brut (jamais de lien mort ni d'échec de build).
 */
export const resolveDomaineLink = unstable_cache(
  async (idOrSlug: string): Promise<{ slug: string; nom: string } | null> => {
    const fw = await prisma.framework.findFirst({
      where: { statut: "publie", OR: [{ slug: idOrSlug }, { id: idOrSlug }] },
      select: { slug: true, id: true, nom: true },
    });
    if (!fw) return null;
    return { slug: fw.slug ?? fw.id, nom: fw.nom };
  },
  ["resolve-domaine-link"],
  { revalidate: DAY, tags: [CATALOGUE_TAG] },
);
