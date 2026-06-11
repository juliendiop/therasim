import Link from "next/link";
import { ArrowRight, Eye } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { createTenant } from "../actions";
import { impersonateTenant } from "../impersonate-actions";

export const dynamic = "force-dynamic";

export default async function TenantsPage() {
  const tenants = await prisma.tenant.findMany({ orderBy: { createdAt: "asc" } });
  const userCounts = await prisma.user.groupBy({
    by: ["tenantId"],
    _count: { _all: true },
  });
  const countByTenant = new Map(userCounts.map((u) => [u.tenantId, u._count._all]));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Liste */}
      <div className="lg:col-span-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Plateformes clientes
        </h2>
        <div className="mt-3 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-white">
          {tenants.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
              <Link href={`/admin/tenants/${t.id}`} className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t.nom}</span>
                  <Badge>{t.type === "public" ? "public (B2C)" : "marque blanche"}</Badge>
                  {t.statut !== "actif" && <Badge tone="red">{t.statut}</Badge>}
                </div>
                <div className="text-xs text-[var(--muted)]">
                  /{t.slug} · {countByTenant.get(t.id) ?? 0} utilisateur(s)
                </div>
              </Link>
              <form action={impersonateTenant}>
                <input type="hidden" name="tenantId" value={t.id} />
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                  title="Accéder à la plateforme de ce client"
                >
                  <Eye className="h-3.5 w-3.5" /> Accéder
                </button>
              </form>
              <Link href={`/admin/tenants/${t.id}`}>
                <ArrowRight className="h-4 w-4 text-[var(--muted)]" />
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Création */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Nouvelle plateforme
        </h2>
        <form
          action={createTenant}
          className="mt-3 space-y-3 rounded-xl border border-[var(--border)] bg-white p-4"
        >
          <div>
            <label className="text-xs font-medium">Nom</label>
            <input
              name="nom"
              required
              placeholder="Institut de formation X"
              className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium">Type</label>
            <select
              name="type"
              className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
            >
              <option value="whitelabel">Marque blanche (B2B)</option>
              <option value="public">Public (B2C)</option>
            </select>
          </div>
          <button className="w-full rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]">
            Créer
          </button>
        </form>
      </div>
    </div>
  );
}

function Badge({
  children,
  tone = "indigo",
}: {
  children: React.ReactNode;
  tone?: "indigo" | "red";
}) {
  const cls =
    tone === "red"
      ? "bg-red-50 text-red-700"
      : "bg-[var(--accent-soft)] text-[var(--accent)]";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {children}
    </span>
  );
}
