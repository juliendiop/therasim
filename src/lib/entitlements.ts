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
const DEFAULT_FREE_FRAMEWORKS = "em"; // référentiel d'appel par défaut

/** Référentiels gratuits pour tout inscrit B2C (CSV d'ids, configurable en admin). */
export async function freeFrameworkIds(): Promise<Set<string>> {
  const v = await getConfig(FREE_FRAMEWORKS_CONFIG_KEY);
  const csv = v && v.trim() ? v : DEFAULT_FREE_FRAMEWORKS;
  return new Set(
    csv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

type UserLike = { id: string; tenantId: string; role: Role };

export type FrameworkAccess = {
  /** Référentiels utilisables par CET utilisateur. */
  unlocked: Set<string>;
  /** Référentiels du catalogue visibles mais verrouillés (vitrine incitative). */
  locked: Set<string>;
};

/**
 * Accès effectif d'un utilisateur, référentiel par référentiel.
 * Toujours borné par le plafond tenant (jamais d'accès hors catalogue du tenant).
 */
export async function userFrameworkAccess(user: UserLike): Promise<FrameworkAccess> {
  const tenantIds = await effectiveFrameworkIds(user.tenantId);

  // B2B whitelabel : l'école paie au niveau plateforme -> pas de filtre individuel.
  // Rôles encadrants (admin, formateur, super-admin) : accès complet à leur catalogue.
  const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });
  if (!tenant || tenant.type !== "public" || user.role !== "learner") {
    return { unlocked: tenantIds, locked: new Set() };
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
  if (subscription && subscription.status === "active") {
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: subscription.planId },
    });
    if (plan) {
      // Quota null = tout le catalogue ; sinon, les domaines choisis par l'abonné.
      subUnlocked = plan.frameworkQuota == null ? new Set(tenantIds) : choices;
    }
  }

  const unlocked = new Set<string>();
  const locked = new Set<string>();
  for (const id of tenantIds) {
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
  if (!subscription || subscription.status !== "active") return null;
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
  const tenantIds = await effectiveFrameworkIds(user.tenantId);
  if (!tenantIds.has(frameworkId)) {
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
