import { Filter, Info, TrendingDown } from "lucide-react";
import { funnelSummary } from "@/lib/funnel";

export const dynamic = "force-dynamic";

// Seuil sous lequel les taux sont trop bruités pour être fiables : on l'affiche
// honnêtement plutôt que de laisser croire à des conclusions statistiques.
const LOW_VOLUME_THRESHOLD = 100;

const PERIODS = [
  { key: "today", label: "Aujourd'hui" },
  { key: "yesterday", label: "Hier" },
  { key: "7", label: "7 jours" },
  { key: "30", label: "30 jours" },
  { key: "90", label: "90 jours" },
] as const;

function pct(x: number | null): string {
  if (x === null) return "—";
  return `${Math.round(x * 100)}%`;
}

/** Décalage Europe/Paris (minutes) applicable à cet instant — gère CET/CEST. */
function parisOffsetMinutes(date: Date): number {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    timeZoneName: "shortOffset",
  })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = /GMT([+-]\d+)/.exec(part ?? "");
  return m ? parseInt(m[1], 10) * 60 : 60;
}

/** Instant UTC correspondant à minuit Europe/Paris pour l'année/mois/jour donné. */
function parisMidnightUTC(y: number, m: number, d: number): Date {
  const guess = Date.UTC(y, m - 1, d, 0, 0, 0);
  return new Date(guess - parisOffsetMinutes(new Date(guess)) * 60_000);
}

/** Date -> {y,m,d} du jour calendaire Europe/Paris auquel appartient cet instant. */
function parisYMD(date: Date): { y: number; m: number; d: number } {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" })
    .format(date)
    .split("-")
    .map(Number);
  return { y, m, d };
}

/** Parse "YYYY-MM-DD" -> minuit Europe/Paris ce jour-là, ou null si invalide. */
function parseParisDate(s: string | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const date = parisMidnightUTC(y, m, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Résout la période demandée : plage personnalisée > préréglage > défaut (30 j). */
function resolveRange(sp: { p?: string; from?: string; to?: string }): {
  from: Date;
  to: Date;
  activeKey: string | null;
} {
  const customFrom = parseParisDate(sp.from);
  const customTo = parseParisDate(sp.to);
  if (customFrom && customTo) {
    // Plage inclusive : la borne haute va jusqu'à la fin du jour de fin.
    const endExclusive = new Date(customTo.getTime() + 24 * 60 * 60 * 1000);
    return { from: customFrom, to: endExclusive, activeKey: null };
  }

  const now = new Date();
  if (sp.p === "today") {
    const t = parisYMD(now);
    return { from: parisMidnightUTC(t.y, t.m, t.d), to: now, activeKey: "today" };
  }
  if (sp.p === "yesterday") {
    const t = parisYMD(now);
    const startToday = parisMidnightUTC(t.y, t.m, t.d);
    const startYesterday = new Date(startToday.getTime() - 24 * 60 * 60 * 1000);
    return { from: startYesterday, to: startToday, activeKey: "yesterday" };
  }
  const days = sp.p === "7" ? 7 : sp.p === "90" ? 90 : sp.p === "30" ? 30 : null;
  if (days) {
    return {
      from: new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
      to: now,
      activeKey: String(days),
    };
  }
  return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), to: now, activeKey: "30" };
}

/** "YYYY-MM-DD" en Europe/Paris, pour préremplir les champs date du formulaire. */
function toDateInputValue(date: Date): string {
  const { y, m, d } = parisYMD(date);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export default async function AdminFunnelPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const { from, to, activeKey } = resolveRange(sp);
  const isCustom = activeKey === null;

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
      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <a
            key={p.key}
            href={`/admin/funnel?p=${p.key}`}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              p.key === activeKey
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]"
            }`}
          >
            {p.label}
          </a>
        ))}

        <form
          method="get"
          action="/admin/funnel"
          className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-sm ${
            isCustom
              ? "border-[var(--accent)] bg-[var(--accent-soft)]"
              : "border-[var(--border)]"
          }`}
        >
          <input
            type="date"
            name="from"
            defaultValue={isCustom ? toDateInputValue(from) : undefined}
            className="rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-sm text-[var(--foreground)]"
          />
          <span className="text-[var(--muted)]">→</span>
          <input
            type="date"
            name="to"
            defaultValue={isCustom ? toDateInputValue(new Date(to.getTime() - 1)) : undefined}
            className="rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-sm text-[var(--foreground)]"
          />
          <button
            type="submit"
            className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-white hover:bg-[var(--accent-hover)]"
          >
            Appliquer
          </button>
        </form>
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
