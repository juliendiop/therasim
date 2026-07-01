import { Activity } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  ACTIVITY_TYPE_LABEL,
  buildActivity,
  type ActivityType,
} from "@/lib/activity";

export const dynamic = "force-dynamic";

const PERIODS = [
  { days: 7, label: "7 jours" },
  { days: 30, label: "30 jours" },
  { days: 90, label: "90 jours" },
  { days: 365, label: "1 an" },
];

const TYPE_BADGE: Record<ActivityType, string> = {
  drill: "bg-[var(--accent-soft)] text-[var(--accent)]",
  miniscene: "bg-[var(--ochre-soft)] text-[var(--ochre)]",
  simulation: "bg-[var(--ochre-soft)] text-[var(--ochre)]",
  credit: "bg-gray-100 text-[var(--foreground)]",
  signup: "bg-green-50 text-green-700",
};

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; email?: string; type?: string; days?: string }>;
}) {
  const sp = await searchParams;
  const days = Number(sp.days) || 30;
  const filters = {
    tenantId: sp.tenant || undefined,
    email: sp.email?.trim() || undefined,
    type: sp.type || undefined,
    days,
  };

  const [tenants, { events, kpis, totalMatched }] = await Promise.all([
    prisma.tenant.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
    buildActivity(filters),
  ]);

  return (
    <div>
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5 text-[var(--accent)]" />
        <h2 className="text-lg font-semibold">Journal d&apos;activité</h2>
      </div>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Toutes les actions menées sur les plateformes (exercices, mini-scènes, entretiens,
        crédits, inscriptions), avec l&apos;email et la plateforme.
      </p>

      {/* Filtres */}
      <form method="get" className="mt-5 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs font-medium">Plateforme</label>
          <select
            name="tenant"
            defaultValue={sp.tenant ?? ""}
            className="mt-1 block rounded-lg border border-[var(--border)] p-2 text-sm"
          >
            <option value="">Toutes</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nom}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium">Email</label>
          <input
            name="email"
            defaultValue={sp.email ?? ""}
            placeholder="rechercher…"
            className="mt-1 block rounded-lg border border-[var(--border)] p-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Type</label>
          <select
            name="type"
            defaultValue={sp.type ?? ""}
            className="mt-1 block rounded-lg border border-[var(--border)] p-2 text-sm"
          >
            <option value="">Tous</option>
            {(Object.keys(ACTIVITY_TYPE_LABEL) as ActivityType[]).map((t) => (
              <option key={t} value={t}>
                {ACTIVITY_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium">Période</label>
          <select
            name="days"
            defaultValue={String(days)}
            className="mt-1 block rounded-lg border border-[var(--border)] p-2 text-sm"
          >
            {PERIODS.map((p) => (
              <option key={p.days} value={p.days}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <button className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]">
          Filtrer
        </button>
      </form>

      {/* KPIs */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi k={kpis.total} l="Actions" />
        <Kpi k={kpis.activeUsers} l="Utilisateurs actifs" />
        <Kpi k={kpis.drills} l="Exercices" />
        <Kpi k={kpis.miniscenes} l="Mini-scènes" />
        <Kpi k={kpis.simulations} l="Entretiens" />
        <Kpi k={kpis.creditsConsumed} l="Crédits consommés" />
      </div>

      {/* Tableau */}
      <div className="mt-6 overflow-hidden rounded-xl border border-[var(--border)] bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-tint)] text-left text-xs text-[var(--muted)]">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Plateforme</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Détail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {events.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted)]">
                  Aucune activité sur cette période.
                </td>
              </tr>
            ) : (
              events.map((e, i) => (
                <tr key={i}>
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-[var(--muted)]">
                    {new Date(e.at).toLocaleString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-2 font-medium">{e.email}</td>
                  <td className="px-4 py-2 text-[var(--muted)]">{e.tenantName}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TYPE_BADGE[e.type]}`}
                    >
                      {e.label}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-[var(--muted)]">{e.detail}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {totalMatched > events.length && (
        <p className="mt-2 text-xs text-[var(--muted)]">
          {events.length} évènements affichés sur {totalMatched} — affinez les filtres pour
          réduire la liste.
        </p>
      )}
    </div>
  );
}

function Kpi({ k, l }: { k: number; l: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-4">
      <div className="tabular text-2xl font-semibold text-[var(--foreground)]">{k}</div>
      <div className="mt-1 text-xs text-[var(--muted)]">{l}</div>
    </div>
  );
}
