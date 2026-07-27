// Droits d'accès aux référentiels.
//
// Deux niveaux :
// 1. TENANT (plafond, B2B) : accès = (packs accordés) + (ajouts) − (retraits).
//    C'est ce que la plateforme PEUT proposer à ses membres.
// 2. UTILISATEUR (freemium, B2C uniquement) : parmi les référentiels du tenant
//    public, un apprenant ne débloque que : les gratuits (config admin) +
//    ceux de son forfait d'abonnement actif + ses achats à l'unité.
//    Les tenants whitelabel (B2B) et les rôles encadrants ne sont PAS filtrés :
//    l'école paie au niveau plateforme, ses apprenants ont tout.

import { prisma } from "./prisma";
import { getConfig } from "./config";
import { periodIndexFor } from "./billing-period";
import type { Role } from "./auth";

/** `key` du forfait gratuit (Découverte) : repli quand l'utilisateur n'a pas
 *  d'abonnement actif — socle + 1 spécialité au choix, 1 entretien N3 à vie. */
export const FREE_PLAN_KEY = "decouverte";
/** Quota de spécialités du gratuit si le plan Découverte n'est pas encore en base. */
export const FREE_SPECIALTY_QUOTA = 1;
/** Forfaits autorisant l'échange de spécialité (1×/période de facturation). */
export const SWAP_PLAN_KEYS: readonly string[] = ["essentiel", "praticien"];

/**
 * Un abonnement donne-t-il droit aux avantages du forfait (domaines + crédits) ?
 *
 * SOURCE DE VÉRITÉ UNIQUE : aucune comparaison de statut d'abonnement ne doit
 * exister ailleurs dans le code. `trialing` = essai en cours (bêta fermée, sans
 * carte bancaire) : l'accès est identique à `active`, c'est tout l'intérêt.
 * Statuts Stripe non ouvrants : `past_due`, `canceled`, `incomplete`,
 * `incomplete_expired`, `unpaid`, `paused`.
 */
export const ENTITLED_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const;

export function isSubscriptionEntitled(status: string | null | undefined): boolean {
  return ENTITLED_SUBSCRIPTION_STATUSES.includes(
    status as (typeof ENTITLED_SUBSCRIPTION_STATUSES)[number],
  );
}

/**
 * L'abonnement génère-t-il du CHIFFRE D'AFFAIRES ? Question distincte de l'accès :
 * un essai (`trialing`) ouvre les droits mais n'émet aucune facture, donc aucune
 * commission d'affiliation. À utiliser pour tout ce qui touche au revenu, jamais
 * pour décider d'un accès.
 */
export const BILLABLE_SUBSCRIPTION_STATUSES = ["active"] as const;

export function isSubscriptionBillable(status: string | null | undefined): boolean {
  return BILLABLE_SUBSCRIPTION_STATUSES.includes(
    status as (typeof BILLABLE_SUBSCRIPTION_STATUSES)[number],
  );
}

/** Ensemble des framework_id accessibles par un tenant (avant filtre de statut). */
export async function effectiveFrameworkIds(tenantId: string): Promise<Set<string>> {
  const [tenantPacks, overrides] = await Promise.all([
    prisma.tenantPack.findMany({ where: { tenantId } }),
    prisma.tenantFrameworkOverride.findMany({ where: { tenantId } }),
  ]);

  const ids = new Set<string>();

  if (tenantPacks.length > 0) {
    const packIds = tenantPacks.map((tp) => tp.packId);
    const links = await prisma.packFramework.findMany({
      where: { packId: { in: packIds } },
    });
    for (const l of links) ids.add(l.frameworkId);
  }

  for (const o of overrides) {
    if (o.mode === "add") ids.add(o.frameworkId);
    if (o.mode === "remove") ids.delete(o.frameworkId);
  }

  return ids;
}

/** Vrai si le tenant a accès à ce référentiel (et qu'il est publié). */
export async function tenantCanAccess(
  tenantId: string,
  frameworkId: string,
): Promise<boolean> {
  const ids = await effectiveFrameworkIds(tenantId);
  if (!ids.has(frameworkId)) return false;
  const f = await prisma.framework.findUnique({ where: { id: frameworkId } });
  return Boolean(f && f.statut === "publie");
}

// --- Niveau utilisateur (freemium B2C) --------------------------------------

export const FREE_FRAMEWORKS_CONFIG_KEY = "freemium.free.frameworks";

/** Tous les référentiels PUBLIÉS (socle + spécialités confondus). */
export async function allPublishedFrameworkIds(): Promise<Set<string>> {
  const rows = await prisma.framework.findMany({
    where: { statut: "publie" },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}

/** Référentiels publiés de nature « socle » : accessibles à TOUT compte (gratuit
 *  compris), sans jamais entamer le quota de spécialités. */
export async function socleFrameworkIds(): Promise<Set<string>> {
  const rows = await prisma.framework.findMany({
    where: { statut: "publie", nature: "socle" },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}

/**
 * Droits effectifs d'un utilisateur B2C : forfait actif (abonnement/essai entitled)
 * OU, à défaut, le gratuit « Découverte ». `quota` = nombre de SPÉCIALITÉS ouvertes
 * (null = toutes) ; le socle n'y compte jamais.
 */
export type B2CEntitlement = {
  planKey: string;
  planLabel: string;
  quota: number | null;
  monthlyCredits: number | null;
  entitledSub: boolean;
};

export async function resolveB2CEntitlement(userId: string): Promise<B2CEntitlement> {
  const subscription = await prisma.userSubscription.findUnique({ where: { userId } });
  if (subscription && isSubscriptionEntitled(subscription.status)) {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: subscription.planId } });
    if (plan) {
      return {
        planKey: plan.key,
        planLabel: plan.label,
        quota: plan.frameworkQuota,
        monthlyCredits: plan.monthlyCredits,
        entitledSub: true,
      };
    }
  }
  // Gratuit : lit le plan Découverte s'il est configuré, sinon valeurs par défaut.
  const free = await prisma.subscriptionPlan.findUnique({ where: { key: FREE_PLAN_KEY } });
  return {
    planKey: free?.key ?? FREE_PLAN_KEY,
    planLabel: free?.label ?? "Découverte",
    // Découverte n'est JAMAIS « toutes les spécialités » : repli à 1 si quota absent/null.
    quota: free?.frameworkQuota ?? FREE_SPECIALTY_QUOTA,
    monthlyCredits: free?.monthlyCredits ?? null,
    entitledSub: false,
  };
}

/**
 * Référentiels gratuits pour un inscrit B2C. Depuis la refonte « tout inclus »,
 * le défaut couvre l'INTÉGRALITÉ du catalogue publié : plus aucun domaine n'est
 * payant côté B2C. Reste une configuration (CSV d'ids dans `freemium.free.frameworks`,
 * ou `*`/vide = tout le catalogue) pour rester ajustable sans redéploiement.
 */
export async function freeFrameworkIds(): Promise<Set<string>> {
  const v = (await getConfig(FREE_FRAMEWORKS_CONFIG_KEY))?.trim() ?? "";
  if (!v || v === "*") return allPublishedFrameworkIds();
  return new Set(
    v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

type UserLike = { id: string; tenantId: string; role: Role };

/**
 * Vrai si l'utilisateur peut acheter des offres individuelles (abonnements,
 * référentiels à l'unité) : apprenant du site public (B2C), OU apprenant d'une
 * plateforme B2B dont l'opt-in « offres individuelles » est activé
 * (`Tenant.allowIndividualOffers` — cas « l'école, c'est nous »).
 * Sans opt-in, vendre un abonnement « domaines au choix » à un membre B2B serait
 * trompeur : sa plateforme lui donne déjà tout son catalogue.
 */
export async function canBuyIndividualOffers(user: UserLike): Promise<boolean> {
  if (user.role !== "learner") return false;
  const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });
  if (!tenant) return false;
  return tenant.type === "public" || tenant.allowIndividualOffers;
}

export type FrameworkAccess = {
  /** Référentiels utilisables par CET utilisateur. */
  unlocked: Set<string>;
  /** Référentiels du catalogue visibles mais verrouillés (vitrine incitative). */
  locked: Set<string>;
};

/**
 * Accès effectif d'un utilisateur, référentiel par référentiel.
 * - Rôles encadrants et membres B2B sans opt-in : tout le catalogue de LEUR plateforme.
 * - Apprenants B2C : le catalogue public, filtré freemium (gratuits/abonnement/achats).
 * - Apprenants B2B avec opt-in « offres individuelles » : leur catalogue école toujours
 *   débloqué + le reste du catalogue PUBLIC en vitrine (achetable/abonnable).
 */
export async function userFrameworkAccess(user: UserLike): Promise<FrameworkAccess> {
  const tenantIds = await effectiveFrameworkIds(user.tenantId);

  const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });
  if (!tenant) return { unlocked: tenantIds, locked: new Set() };
  const isPublic = tenant.type === "public";
  if (user.role !== "learner" || (!isPublic && !tenant.allowIndividualOffers)) {
    return { unlocked: tenantIds, locked: new Set() };
  }

  // --- Modèle « socle + spécialités » (B2C) -----------------------------------
  // Le socle est accessible à TOUT compte, gratuit compris, hors quota. Les
  // spécialités sont ouvertes selon le forfait : quota null = toutes, sinon les
  // spécialités choisies (subscription_choice) + les achats à vie. Un compte
  // Découverte (sans abonnement) a droit au socle + 1 spécialité de son choix.
  if (isPublic) {
    const [allIds, socle, ent, accessRows] = await Promise.all([
      allPublishedFrameworkIds(),
      socleFrameworkIds(),
      resolveB2CEntitlement(user.id),
      prisma.userFrameworkAccess.findMany({ where: { userId: user.id } }),
    ]);
    const owned = new Set(
      accessRows.filter((r) => r.source !== "subscription_choice").map((r) => r.frameworkId),
    );
    const choices = new Set(
      accessRows.filter((r) => r.source === "subscription_choice").map((r) => r.frameworkId),
    );

    const open = new Set<string>(socle); // socle : toujours, hors quota
    for (const id of owned) open.add(id); // achats à vie / octrois admin
    if (ent.quota == null) {
      for (const id of allIds) open.add(id); // toutes les spécialités
    } else {
      for (const id of choices) open.add(id); // spécialités choisies (dans le quota)
    }

    const unlocked = new Set<string>();
    const locked = new Set<string>();
    for (const id of allIds) (open.has(id) ? unlocked : locked).add(id);
    return { unlocked, locked };
  }

  // Plafond de vente individuelle = catalogue du site public (ce qui est commercialisé).
  // (Chemin B2B « opt-in offres individuelles » — HORS PÉRIMÈTRE de la refonte, inchangé.)
  let saleIds: Set<string>;
  if (isPublic) {
    saleIds = tenantIds;
  } else {
    const pub = await prisma.tenant.findUnique({ where: { slug: "public" } });
    saleIds = pub ? await effectiveFrameworkIds(pub.id) : new Set<string>();
  }

  const [free, subscription, accessRows] = await Promise.all([
    freeFrameworkIds(),
    prisma.userSubscription.findUnique({ where: { userId: user.id } }),
    prisma.userFrameworkAccess.findMany({ where: { userId: user.id } }),
  ]);

  // Accès à vie (achat à l'unité, octroi admin) : toujours valides.
  const owned = new Set(
    accessRows.filter((r) => r.source !== "subscription_choice").map((r) => r.frameworkId),
  );
  // Choix consommés sur le quota du forfait : valides seulement si l'abonnement
  // est actif (un abo résilié en fin de période reste 'active' jusqu'à son terme).
  const choices = new Set(
    accessRows.filter((r) => r.source === "subscription_choice").map((r) => r.frameworkId),
  );

  let subUnlocked = new Set<string>();
  if (subscription && isSubscriptionEntitled(subscription.status)) {
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: subscription.planId },
    });
    if (plan) {
      // Quota null = tout le catalogue en vente ; sinon, les domaines choisis.
      subUnlocked = plan.frameworkQuota == null ? new Set(saleIds) : choices;
    }
  }

  // Membre B2B opt-in : son catalogue école est acquis d'office.
  const unlocked = new Set<string>(isPublic ? [] : tenantIds);
  const locked = new Set<string>();
  for (const id of saleIds) {
    if (unlocked.has(id)) continue;
    if (free.has(id) || owned.has(id) || subUnlocked.has(id)) unlocked.add(id);
    else locked.add(id);
  }
  return { unlocked, locked };
}

/**
 * État du quota de SPÉCIALITÉS de l'utilisateur B2C (forfait actif ou Découverte).
 * Le socle n'est jamais compté. `quota` null = toutes les spécialités.
 * `canSwap` : le forfait autorise l'échange 1×/période (Essentiel, Praticien).
 */
export async function subscriptionChoiceStatus(userId: string): Promise<{
  planKey: string;
  planLabel: string;
  quota: number | null;
  used: number;
  remaining: number | null;
  entitledSub: boolean;
  canSwap: boolean;
}> {
  const ent = await resolveB2CEntitlement(userId);
  const used = await prisma.userFrameworkAccess.count({
    where: { userId, source: "subscription_choice" },
  });
  return {
    planKey: ent.planKey,
    planLabel: ent.planLabel,
    quota: ent.quota,
    used,
    remaining: ent.quota == null ? null : Math.max(0, ent.quota - used),
    entitledSub: ent.entitledSub,
    canSwap: ent.entitledSub && SWAP_PLAN_KEYS.includes(ent.planKey),
  };
}

/**
 * Consomme un choix du quota pour ouvrir une SPÉCIALITÉ. Le socle est déjà inclus
 * partout (aucun choix requis). Fonctionne aussi pour le gratuit (Découverte, 1 choix).
 * Le choix est conservé ; l'échange se fait via `swapSpecialtyChoice` (forfaits éligibles).
 */
export async function activateSubscriptionChoice(
  user: UserLike,
  frameworkId: string,
): Promise<{ ok: boolean; message: string }> {
  const framework = await prisma.framework.findUnique({ where: { id: frameworkId } });
  if (!framework || framework.statut !== "publie") {
    return { ok: false, message: "Cette spécialité n'est pas disponible." };
  }
  if (framework.nature === "socle") {
    return { ok: true, message: "Ce domaine fait partie du socle : il est déjà inclus." };
  }

  const access = await userFrameworkAccess(user);
  if (access.unlocked.has(frameworkId)) {
    return { ok: true, message: "Cette spécialité est déjà ouverte pour vous." };
  }
  if (!access.locked.has(frameworkId)) {
    return { ok: false, message: "Cette spécialité n'est pas disponible." };
  }

  const status = await subscriptionChoiceStatus(user.id);
  if (status.quota == null) return { ok: true, message: "Toutes les spécialités sont déjà incluses." };
  if (status.remaining !== null && status.remaining <= 0) {
    const swapHint = status.canSwap
      ? " Vous pouvez échanger une de vos spécialités contre celle-ci (une fois par période), ou passer au forfait supérieur."
      : " Passez à un forfait supérieur pour ouvrir plus de spécialités.";
    return {
      ok: false,
      message: `Votre forfait ${status.planLabel} inclut ${status.quota} spécialité${status.quota > 1 ? "s" : ""} — quota atteint.${swapHint}`,
    };
  }

  await prisma.userFrameworkAccess.upsert({
    where: { userId_frameworkId: { userId: user.id, frameworkId } },
    update: {}, // déjà ouvert (achat ou choix antérieur) : rien à faire
    create: { userId: user.id, frameworkId, source: "subscription_choice" },
  });
  return { ok: true, message: "Spécialité ouverte !" };
}

/**
 * Échange une spécialité choisie contre une autre — une seule fois par période de
 * facturation, sur les forfaits éligibles (Essentiel, Praticien). Dédup par `periodIndex`
 * (même clé que la recharge). AUCUNE progression n'est supprimée : on ne retire que la
 * ligne d'accès `UserFrameworkAccess` ; les `Attempt`/`UserCompetencyState` restent en base
 * et redeviennent visibles si l'utilisateur revient sur la spécialité abandonnée.
 */
export async function swapSpecialtyChoice(
  user: UserLike,
  dropFrameworkId: string,
  addFrameworkId: string,
): Promise<{ ok: boolean; message: string }> {
  if (dropFrameworkId === addFrameworkId) {
    return { ok: false, message: "Choisissez deux spécialités différentes." };
  }
  const subscription = await prisma.userSubscription.findUnique({ where: { userId: user.id } });
  if (!subscription || !isSubscriptionEntitled(subscription.status)) {
    return { ok: false, message: "L'échange de spécialité nécessite un abonnement actif." };
  }
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: subscription.planId } });
  if (!plan || !SWAP_PLAN_KEYS.includes(plan.key)) {
    return { ok: false, message: "Votre forfait n'autorise pas l'échange de spécialité." };
  }

  const anchor = subscription.periodAnchorAt ?? subscription.createdAt;
  const currentIndex = periodIndexFor(anchor, new Date());
  if (subscription.specialtySwapPeriodIndex === currentIndex) {
    return {
      ok: false,
      message:
        "Vous avez déjà échangé une spécialité cette période. Un nouvel échange sera possible au prochain renouvellement.",
    };
  }

  // La spécialité abandonnée doit être un choix courant ; la nouvelle, une spécialité
  // publiée verrouillée (ni socle, ni déjà ouverte).
  const dropRow = await prisma.userFrameworkAccess.findUnique({
    where: { userId_frameworkId: { userId: user.id, frameworkId: dropFrameworkId } },
  });
  if (!dropRow || dropRow.source !== "subscription_choice") {
    return { ok: false, message: "La spécialité à remplacer n'est pas l'un de vos choix." };
  }
  const addFw = await prisma.framework.findUnique({ where: { id: addFrameworkId } });
  if (!addFw || addFw.statut !== "publie" || addFw.nature === "socle") {
    return { ok: false, message: "Spécialité cible invalide." };
  }
  const access = await userFrameworkAccess(user);
  if (access.unlocked.has(addFrameworkId)) {
    return { ok: true, message: "Cette spécialité est déjà ouverte pour vous." };
  }

  await prisma.$transaction([
    prisma.userFrameworkAccess.deleteMany({
      where: { userId: user.id, frameworkId: dropFrameworkId, source: "subscription_choice" },
    }),
    prisma.userFrameworkAccess.upsert({
      where: { userId_frameworkId: { userId: user.id, frameworkId: addFrameworkId } },
      update: {},
      create: { userId: user.id, frameworkId: addFrameworkId, source: "subscription_choice" },
    }),
    prisma.userSubscription.update({
      where: { userId: user.id },
      data: { specialtySwapPeriodIndex: currentIndex },
    }),
  ]);
  return {
    ok: true,
    message: "Spécialité échangée. Votre progression sur l'ancienne reste conservée.",
  };
}

/** Vrai si CET utilisateur peut utiliser ce référentiel (publié + débloqué pour lui). */
export async function userCanAccess(
  user: UserLike,
  frameworkId: string,
): Promise<boolean> {
  const { unlocked } = await userFrameworkAccess(user);
  if (!unlocked.has(frameworkId)) return false;
  const f = await prisma.framework.findUnique({ where: { id: frameworkId } });
  return Boolean(f && f.statut === "publie");
}
