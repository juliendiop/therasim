import { Filter, Info, TrendingDown } from "lucide-react";
import { funnelSummary } from "@/lib/funnel";

export const dynamic = "force-dynamic";

// Seuil sous lequel les taux sont trop bruités pour être fiables : on l'affiche
// honnêtement plutôt que de laisser croire à des conclusions statistiques.
const LOW_VOLUME_THRESHOLD = 100;

const PERIODS = [
  { key: "7", days: 7, label: "7 jours" },
  { key: "30", days: 30, label: "30 jours" },
  { key: "90", days: 90, label: "90 jours" },
] as const;

function pct(x: number | null): string {
  if (x === null) return "—";
  return `${Math.round(x * 100)}%`;
}

export default async function AdminFunnelPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const sp = await searchParams;
  const period = PERIODS.find((p) => p.key === sp.p) ?? PERIODS[1];
  const to = new Date();
  const from = new Date(to.getTime() - period.days * 24 * 60 * 60 * 1000);

  const { steps, total } = await funnelSummary({ from, to });
  const lowVolume = total < LOW_VOLUME_THRESHOLD;
  const maxCount = Math.max(1, ...steps.map((s) => s.count));

  // Conversion globale visite -> achat (le chiffre qui résume l'entonnoir).
  const landing = steps.find((s) => s.event === "landing_view")?.count ?? 0;
  const purchases = steps.find((s) => s.event === "purchase")?.count ?? 0;
  const globalConv = landing > 0 ? purchases / landing : null;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-[var(--accent)]" />
          <h2 className="text-lg font-semibold">Entonnoir d&apos;acquisition</h2>
        </div>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Où les visiteurs avancent — et où ils décrochent. Mesure first-party, sans donnée
          personnelle.
        </p>
      </div>

      {/* Sélecteur de période */}
      <div className="flex gap-2">
        {PERIODS.map((p) => (
          <a
            key={p.key}
            href={`/admin/funnel?p=${p.key}`}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              p.key === period.key
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]"
            }`}
          >
            {p.label}
          </a>
        ))}
      </div>

      {lowVolume && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <b>Volume faible</b> ({total} visite{total > 1 ? "s" : ""} sur la période). Les
            taux ci-dessous sont indicatifs, pas statistiquement fiables — utiles pour repérer
            un décrochage flagrant, pas pour conclure finement. Il faut plus de trafic (visez
            au moins {LOW_VOLUME_THRESHOLD}) avant d&apos;en tirer des décisions.
          </span>
        </div>
      )}

      {/* Conversion globale */}
      <div className="rounded-xl border border-[var(--border)] bg-white p-5">
        <div className="text-xs uppercase tracking-wide text-[var(--muted)]">
          Conversion globale (visite → achat)
        </div>
        <div className="mt-1 text-3xl font-bold text-[var(--accent)]">{pct(globalConv)}</div>
      </div>

      {/* Étapes de l'entonnoir */}
      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-tint)] text-left text-xs text-[var(--muted)]">
            <tr>
              <th className="px-4 py-2">Étape</th>
              <th className="px-4 py-2 text-right">Volume</th>
              <th className="px-4 py-2 text-right">Conversion depuis l&apos;étape précédente</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {steps.map((s) => {
              const dropoff = s.fromPrev !== null && s.fromPrev < 0.3;
              return (
                <tr key={s.event}>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{s.label}</div>
                    {/* Barre proportionnelle au volume max */}
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-[var(--accent)]"
                        style={{ width: `${Math.round((s.count / maxCount) * 100)}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right align-top tabular font-semibold">
                    {s.count}
                  </td>
                  <td className="px-4 py-2.5 text-right align-top">
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${
                        dropoff ? "text-red-600" : "text-[var(--foreground)]"
                      }`}
                    >
                      {dropoff && <TrendingDown className="h-3.5 w-3.5" />}
                      {pct(s.fromPrev)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[var(--muted)]">
        Un taux en rouge (&lt; 30 %) signale un décrochage important à cette étape — le
        premier endroit où concentrer les efforts d&apos;optimisation.
      </p>
    </div>
  );
}
