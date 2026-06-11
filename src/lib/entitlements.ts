// Droits d'accès aux référentiels par tenant (modèle catalogue + packs).
// accès = (référentiels des packs accordés) + (ajouts manuels) − (retraits manuels).

import { prisma } from "./prisma";

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
