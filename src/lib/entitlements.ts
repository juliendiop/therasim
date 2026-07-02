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

  const [free, subscription, purchases] = await Promise.all([
    freeFrameworkIds(),
    prisma.userSubscription.findUnique({ where: { userId: user.id } }),
    prisma.userFrameworkAccess.findMany({ where: { userId: user.id } }),
  ]);

  // Référentiels du forfait, si abonnement actif (un abo résilié en fin de
  // période reste 'active' jusqu'à son terme — comportement voulu).
  const planFrameworks = new Set<string>();
  if (subscription && subscription.status === "active") {
    const links = await prisma.planFramework.findMany({
      where: { planId: subscription.planId },
    });
    for (const l of links) planFrameworks.add(l.frameworkId);
  }

  const owned = new Set(purchases.map((p) => p.frameworkId));

  const unlocked = new Set<string>();
  const locked = new Set<string>();
  for (const id of tenantIds) {
    if (free.has(id) || planFrameworks.has(id) || owned.has(id)) unlocked.add(id);
    else locked.add(id);
  }
  return { unlocked, locked };
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
