import { notFound } from "next/navigation";
import { Check, Eye } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { effectiveFrameworkIds } from "@/lib/entitlements";
import {
  renameTenant,
  setFrameworkOverride,
  toggleTenantPack,
  updateBranding,
} from "../../actions";
import { impersonateTenant } from "../../impersonate-actions";

export const dynamic = "force-dynamic";

export default async function TenantDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) notFound();

  const [packs, tenantPacks, overrides, frameworks, effIds, users, attempts] =
    await Promise.all([
      prisma.pack.findMany({ orderBy: { nom: "asc" } }),
      prisma.tenantPack.findMany({ where: { tenantId: id } }),
      prisma.tenantFrameworkOverride.findMany({ where: { tenantId: id } }),
      prisma.framework.findMany({ where: { statut: "publie" }, orderBy: { nom: "asc" } }),
      effectiveFrameworkIds(id),
      prisma.user.count({ where: { tenantId: id } }),
      prisma.attempt.count({ where: { tenantId: id } }),
    ]);

  const grantedPackIds = new Set(tenantPacks.map((tp) => tp.packId));
  const overrideByFw = new Map(overrides.map((o) => [o.frameworkId, o.mode]));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{tenant.nom}</h2>
          <p className="text-xs text-[var(--muted)]">
            /{tenant.slug} · {tenant.type === "public" ? "public (B2C)" : "marque blanche"} ·{" "}
            {users} utilisateur(s) · {attempts} essai(s)
          </p>
        </div>
        <form action={impersonateTenant}>
          <input type="hidden" name="tenantId" value={id} />
          <button className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]">
            <Eye className="h-4 w-4" /> Accéder à la plateforme
          </button>
        </form>
      </div>

      {/* Renommer la plateforme */}
      <section>
        <h3 className="text-sm font-semibold">Nom de la plateforme</h3>
        <form action={renameTenant} className="mt-2 flex flex-wrap items-end gap-2">
          <input type="hidden" name="tenantId" value={id} />
          <div className="min-w-[240px] flex-1">
            <input
              name="nom"
              defaultValue={tenant.nom}
              required
              className="w-full rounded-lg border border-[var(--border)] p-2 text-sm"
            />
          </div>
          <button className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]">
            Renommer
          </button>
        </form>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Le nom interne de la plateforme. Pour l&apos;affichage en marque blanche côté
          apprenant, utilisez le « Nom de marque » ci-dessous.
        </p>
      </section>

      {/* Packs accordés */}
      <section>
        <h3 className="text-sm font-semibold">Packs accordés</h3>
        <p className="text-xs text-[var(--muted)]">
          Attribution « en masse » : accorder un pack donne accès à tous ses référentiels.
        </p>
        <div className="mt-3 space-y-2">
          {packs.length === 0 && (
            <p className="text-sm text-[var(--muted)]">Aucun pack. Créez-en dans « Packs ».</p>
          )}
          {packs.map((p) => {
            const granted = grantedPackIds.has(p.id);
            return (
              <form
                key={p.id}
                action={toggleTenantPack}
                className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-white px-4 py-2.5"
              >
                <input type="hidden" name="tenantId" value={id} />
                <input type="hidden" name="packId" value={p.id} />
                <div>
                  <span className="text-sm font-medium">{p.nom}</span>
                  {p.description && (
                    <span className="ml-2 text-xs text-[var(--muted)]">{p.description}</span>
                  )}
                </div>
                <button
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                    granted
                      ? "bg-green-50 text-green-700 hover:bg-green-100"
                      : "border border-[var(--border)] hover:border-[var(--accent)]"
                  }`}
                >
                  {granted ? "✓ Accordé" : "Accorder"}
                </button>
              </form>
            );
          })}
        </div>
      </section>

      {/* Ajustement fin par référentiel */}
      <section>
        <h3 className="text-sm font-semibold">Ajustement fin (référentiels)</h3>
        <p className="text-xs text-[var(--muted)]">
          Accès effectif = packs + ajouts − retraits. Forcez l&apos;ajout ou le retrait d&apos;un
          référentiel pour ce client (utile en négociation).
        </p>
        <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-[var(--muted)]">
              <tr>
                <th className="px-4 py-2">Référentiel</th>
                <th className="px-4 py-2">Accès effectif</th>
                <th className="px-4 py-2">Ajustement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {frameworks.map((f) => {
                const eff = effIds.has(f.id);
                const ov = overrideByFw.get(f.id);
                return (
                  <tr key={f.id}>
                    <td className="px-4 py-2 font-medium">{f.nom}</td>
                    <td className="px-4 py-2">
                      {eff ? (
                        <span className="inline-flex items-center gap-1 text-green-700">
                          <Check className="h-3.5 w-3.5" /> oui
                        </span>
                      ) : (
                        <span className="text-[var(--muted)]">non</span>
                      )}
                      {ov && (
                        <span className="ml-2 text-[11px] text-amber-700">
                          (forcé : {ov === "add" ? "ajout" : "retrait"})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <form action={setFrameworkOverride} className="flex items-center gap-1">
                        <input type="hidden" name="tenantId" value={id} />
                        <input type="hidden" name="frameworkId" value={f.id} />
                        <select
                          name="mode"
                          defaultValue={ov ?? "none"}
                          className="rounded border border-[var(--border)] px-2 py-1 text-xs"
                        >
                          <option value="none">— (suivre les packs)</option>
                          <option value="add">Forcer l&apos;ajout</option>
                          <option value="remove">Forcer le retrait</option>
                        </select>
                        <button className="rounded border border-[var(--border)] px-2 py-1 text-xs hover:border-[var(--accent)]">
                          OK
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Branding (marque blanche) */}
      <section>
        <h3 className="text-sm font-semibold">Marque blanche</h3>
        <form
          action={updateBranding}
          className="mt-3 grid gap-3 rounded-xl border border-[var(--border)] bg-white p-4 sm:grid-cols-2"
        >
          <input type="hidden" name="tenantId" value={id} />
          <div>
            <label className="text-xs font-medium">Nom de marque</label>
            <input
              name="brandName"
              defaultValue={tenant.brandName ?? ""}
              placeholder="ex. Académie X"
              className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium">Couleur principale (hex)</label>
            <input
              name="colorPrimary"
              defaultValue={tenant.colorPrimary ?? ""}
              placeholder="#4f46e5"
              className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium">Logo (URL)</label>
            <input
              name="logoUrl"
              defaultValue={tenant.logoUrl ?? ""}
              placeholder="https://…/logo.png"
              className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium">Statut</label>
            <select
              name="statut"
              defaultValue={tenant.statut}
              className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
            >
              <option value="actif">Actif</option>
              <option value="suspendu">Suspendu</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <button className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]">
              Enregistrer
            </button>
          </div>
        </form>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Note : l&apos;application visuelle du branding (logo/couleurs côté apprenant) et le
          sous-domaine dédié sont au backlog. Ici on stocke et pilote les valeurs.
        </p>
      </section>
    </div>
  );
}
