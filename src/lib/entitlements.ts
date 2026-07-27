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
import type { Role } from "./auth";

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

/** Tous les référentiels PUBLIÉS. Depuis la refonte « tout inclus », c'est le
 *  catalogue accessible à tout compte B2C (gratuit compris). */
export async function allPublishedFrameworkIds(): Promise<Set<string>> {
  const rows = await prisma.framework.findMany({
    where: { statut: "publie" },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
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

  // --- Refonte « tout inclus » (B2C) ------------------------------------------
  // Le gating par domaine est SUPPRIMÉ sur le site public : tout compte, gratuit
  // compris, accède à l'intégralité du catalogue publié. Le seul verrou restant est
  // le solde de crédits (mises en situation IA), appliqué dans sim/actions. Ni
  // `frameworkQuota`, ni les achats à l'unité, ni `subscription_choice` n'entrent
  // plus en jeu ici — `locked` est toujours vide, donc aucune vitrine « à débloquer ».
  if (isPublic) {
    return { unlocked: await allPublishedFrameworkIds(), locked: new Set() };
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

/** État du quota de choix de l'abonné (null si pas d'abonnement actif). */
export async function subscriptionChoiceStatus(userId: string): Promise<{
  planLabel: string;
  quota: number | null; // null = tout le catalogue (rien à choisir)
  used: number;
  remaining: number | null;
} | null> {
  const subscription = await prisma.userSubscription.findUnique({ where: { userId } });
  if (!subscription || !isSubscriptionEntitled(subscription.status)) return null;
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: subscription.planId },
  });
  if (!plan) return null;
  const used = await prisma.userFrameworkAccess.count({
    where: { userId, source: "subscription_choice" },
  });
  return {
    planLabel: plan.label,
    quota: plan.frameworkQuota,
    used,
    remaining: plan.frameworkQuota == null ? null : Math.max(0, plan.frameworkQuota - used),
  };
}

/**
 * Consomme un choix du quota d'abonnement pour débloquer un référentiel.
 * Choix DÉFINITIF tant qu'on est abonné (pas d'échange — anti-abus).
 */
export async function activateSubscriptionChoice(
  user: UserLike,
  frameworkId: string,
): Promise<{ ok: boolean; message: string }> {
  // Réutilise la logique d'accès complète (plafond de vente, opt-in B2B…).
  const access = await userFrameworkAccess(user);
  if (access.unlocked.has(frameworkId)) {
    return { ok: true, message: "Ce domaine est déjà débloqué pour vous." };
  }
  if (!access.locked.has(frameworkId)) {
    return { ok: false, message: "Ce domaine n'est pas disponible." };
  }
  const framework = await prisma.framework.findUnique({ where: { id: frameworkId } });
  if (!framework || framework.statut !== "publie") {
    return { ok: false, message: "Ce domaine n'est pas disponible." };
  }

  const status = await subscriptionChoiceStatus(user.id);
  if (!status) return { ok: false, message: "Aucun abonnement actif." };
  if (status.quota == null) return { ok: true, message: "Déjà inclus dans votre forfait." };
  if (status.remaining !== null && status.remaining <= 0) {
    return {
      ok: false,
      message: `Votre forfait ${status.planLabel} inclut ${status.quota} domaine${status.quota > 1 ? "s" : ""} — quota atteint. Passez à un forfait supérieur ou achetez ce domaine à l'unité.`,
    };
  }

  await prisma.userFrameworkAccess.upsert({
    where: { userId_frameworkId: { userId: user.id, frameworkId } },
    update: {}, // déjà débloqué (achat ou choix antérieur) : rien à faire
    create: { userId: user.id, frameworkId, source: "subscription_choice" },
  });
  return { ok: true, message: "Domaine débloqué !" };
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
