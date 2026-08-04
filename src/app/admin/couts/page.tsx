import Link from "next/link";
import { Coins, AlertTriangle, TrendingDown, Gift, PlayCircle, Infinity as InfinityIcon } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth";
import { LLM_USAGES } from "@/lib/config";
import { getCostDashboard, detectAndRecordCostAlerts } from "@/lib/cost-analytics";
import { setCostThresholdsAction } from "./actions";

export const dynamic = "force-dynamic";

const USAGE_LABEL: Record<string, string> = Object.fromEntries(
  LLM_USAGES.map((u) => [u.key, u.label]),
);

/** Centimes → « 0,42 € » (une seule règle d'affichage monétaire). */
function eur(cents: number): string {
  return `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

const PERIODS = [
  { days: 7, label: "7 j" },
  { days: 30, label: "30 j" },
  { days: 90, label: "90 j" },
];

export default async function CoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  await requireSuperAdmin();
  const { days: daysRaw } = await searchParams;
  const days = [7, 30, 90].includes(Number(daysRaw)) ? Number(daysRaw) : 30;
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  const [data, alerts] = await Promise.all([
    getCostDashboard({ from, to }),
    detectAndRecordCostAlerts(),
  ]);

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-[var(--accent)]" />
          <h2 className="text-lg font-semibold">Coûts IA</h2>
        </div>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Coût réel journalisé de chaque appel LLM. Aucun contenu de prompt n&apos;est stocké,
          seulement des compteurs.
        </p>
        <div className="mt-3 flex gap-1.5">
          {PERIODS.map((p) => (
            <Link
              key={p.days}
              href={`/admin/couts?days=${p.days}`}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                days === p.days
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "border-[var(--border)] bg-white text-[var(--muted)]"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Alertes actives (aussi écrites en base pour un futur envoi périodique). */}
      {alerts.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-center gap-2 font-medium text-amber-800">
            <AlertTriangle className="h-4 w-4" /> Seuils de coût franchis
          </div>
          <ul className="mt-2 space-y-1 text-sm text-amber-800">
            {alerts.map((a, i) => (
              <li key={i}>
                {a.label} : <b>{eur(a.amountCents)}</b> (seuil {eur(a.thresholdCents)})
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Chiffres clés */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card label="Dépense totale" value={eur(data.totalCents)} sub={`${data.totalCalls} appels`} />
        <Card
          label="Coût / crédit débité"
          value={eur(data.perCredit.perCreditCents)}
          sub={`objectif ${eur(data.perCredit.targetCents)} · ${data.perCredit.credits} crédits`}
          danger={data.perCredit.over}
        />
        <Card
          label="Coût moyen séance"
          value={eur(data.sessions.perN3Cents)}
          sub={`N3 (${data.sessions.n3Count}) · N2 ${eur(data.sessions.perN2Cents)} (${data.sessions.n2Count})`}
        />
      </div>

      {/* Par usage + taux de cache */}
      <Section title="Par usage">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-[var(--muted)]">
            <tr>
              <th className="py-1.5">Usage</th>
              <th className="py-1.5 text-right">Dépense</th>
              <th className="py-1.5 text-right">Appels</th>
              <th className="py-1.5 text-right">Coût/appel</th>
              <th className="py-1.5 text-right">Lecture cache</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {data.byUsage.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-center text-[var(--muted)]">
                  Aucun appel sur la période.
                </td>
              </tr>
            ) : (
              data.byUsage.map((u) => (
                <tr key={u.usage}>
                  <td className="py-1.5">{USAGE_LABEL[u.usage] ?? u.usage}</td>
                  <td className="py-1.5 text-right tabular">{eur(u.costCents)}</td>
                  <td className="py-1.5 text-right tabular">{u.calls}</td>
                  <td className="py-1.5 text-right tabular">{eur(u.avgCents)}</td>
                  <td className="py-1.5 text-right tabular">{u.cacheReadRate}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Le <b>taux de lecture de cache</b> (lectures ÷ tokens d&apos;entrée totaux) est ton
          principal levier de marge sur les prompts longs et stables (patient, évaluateur).
        </p>
      </Section>

      {/* Coût mensuel par utilisateur actif */}
      <Section title={`Coût mensuel par utilisateur actif — ${data.monthLabel}`}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Mini label="Actifs" value={String(data.perUser.activeUsers)} />
          <Mini label="Médiane" value={eur(data.perUser.medianCents)} />
          <Mini label="90e centile" value={eur(data.perUser.p90Cents)} />
          <Mini label="Maximum" value={eur(data.perUser.maxCents)} />
        </div>
        {data.top10.length > 0 && (
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-xs text-[var(--muted)]">
              <tr>
                <th className="py-1.5">Top 10 du mois</th>
                <th className="py-1.5">Forfait</th>
                <th className="py-1.5 text-right">Coût</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {data.top10.map((u, i) => (
                <tr key={i}>
                  <td className="py-1.5">{u.email}</td>
                  <td className="py-1.5 text-[var(--muted)]">{u.forfait}</td>
                  <td className="py-1.5 text-right tabular">{eur(u.costCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Marge brute par forfait */}
      <Section title="Marge brute par forfait (mensuel)">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-[var(--muted)]">
            <tr>
              <th className="py-1.5">Forfait</th>
              <th className="py-1.5 text-right">Abonnés</th>
              <th className="py-1.5 text-right">Recette/ab.</th>
              <th className="py-1.5 text-right">Coût IA/ab.</th>
              <th className="py-1.5 text-right">Marge/ab.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {data.margins.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-center text-[var(--muted)]">
                  Aucun abonnement actif.
                </td>
              </tr>
            ) : (
              data.margins.map((m) => (
                <tr key={m.forfait}>
                  <td className="py-1.5">
                    {m.forfait}
                    {m.unlimited && (
                      <span className="ml-1 inline-flex items-center gap-0.5 text-xs text-[var(--muted)]">
                        <InfinityIcon className="h-3 w-3" /> sans compter
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 text-right tabular">{m.subscribers}</td>
                  <td className="py-1.5 text-right tabular">{eur(m.revenuePerSubCents)}</td>
                  <td className="py-1.5 text-right tabular">{eur(m.iaCostPerSubCents)}</td>
                  <td className={`py-1.5 text-right tabular font-medium ${m.marginPerSubCents < 0 ? "text-red-600" : "text-green-700"}`}>
                    {eur(m.marginPerSubCents)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Recette = prix mensuel du forfait (l&apos;annuel n&apos;est pas amorti ici). Répond à
          « un abonné à 29 € est-il rentable ? ».
        </p>
      </Section>

      {/* Trois lignes isolées */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Isolated
          icon={<TrendingDown className="h-4 w-4" />}
          title="Drills gratuits"
          value={eur(data.freeDrills.costCents)}
          lines={[
            `${data.freeDrills.calls} appels · ${data.freeDrills.activeUsers} utilisateurs`,
            `${eur(data.freeDrills.perUserCents)} / utilisateur actif`,
            "Coût sans crédit (fuite de marge)",
          ]}
          accent="red"
        />
        <Isolated
          icon={<PlayCircle className="h-4 w-4" />}
          title="Démo publique"
          value={eur(data.demo.costCents)}
          lines={[`${data.demo.calls} appels`, "Coût d'acquisition (userId nul)"]}
        />
        <Isolated
          icon={<Gift className="h-4 w-4" />}
          title="Abonnés « sans compter »"
          value={`${data.sansCompter.length} abonné(s)`}
          lines={
            data.sansCompter.length === 0
              ? ["Aucun abonné illimité actif"]
              : data.sansCompter.slice(0, 4).map((u) => `${u.email} — ${eur(u.monthlyCostCents)}/mois`)
          }
        />
      </div>

      {/* Tarifs manquants */}
      {data.missingPricing.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="font-medium">Tarifs manquants (coût compté à 0 pour ces modèles)</div>
          <ul className="mt-1 list-disc pl-5">
            {data.missingPricing.map((m, i) => (
              <li key={i}>
                {m.provider} / <span className="font-mono">{m.model}</span>
              </li>
            ))}
          </ul>
          <Link href="/admin/modeles" className="mt-1 inline-block underline">
            Renseigner les tarifs
          </Link>
        </div>
      )}

      {/* Réglage des seuils d'alerte */}
      <Section title="Seuils d'alerte">
        <form action={setCostThresholdsAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm">
            Objectif coût / crédit (€)
            <input
              name="targetPerCredit"
              type="number"
              step="0.01"
              min={0}
              defaultValue={data.thresholds.targetPerCredit}
              className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
            />
          </label>
          <label className="flex-1 text-sm">
            Alerte / abonné / mois (€)
            <input
              name="userMonthly"
              type="number"
              step="0.5"
              min={0}
              defaultValue={data.thresholds.userMonthly}
              className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
            />
          </label>
          <label className="flex-1 text-sm">
            Plafond global / jour (€)
            <input
              name="dailyGlobal"
              type="number"
              step="1"
              min={0}
              defaultValue={data.thresholds.dailyGlobal}
              className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
            />
          </label>
          <button className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]">
            Enregistrer
          </button>
        </form>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Alerte <b>visuelle</b> (pas d&apos;email) ; les franchissements sont écrits en base. Ce
          filet complète <Link href="/admin/usage" className="text-[var(--accent)] hover:underline">Consommation IA</Link>,
          qui, lui, <b>bloque</b> en temps réel l&apos;usage abusif (dont les abonnés « sans compter »).
        </p>
      </Section>
    </div>
  );
}

function Card({ label, value, sub, danger }: { label: string; value: string; sub?: string; danger?: boolean }) {
  return (
    <div className={`rounded-xl border bg-white p-4 ${danger ? "border-red-300" : "border-[var(--border)]"}`}>
      <div className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular ${danger ? "text-red-600" : ""}`}>{value}</div>
      {sub && <div className="text-[11px] text-[var(--muted)]">{sub}</div>}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-3">
      <div className="text-[11px] uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-white p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-3 overflow-x-auto">{children}</div>
    </section>
  );
}

function Isolated({
  icon,
  title,
  value,
  lines,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  lines: string[];
  accent?: "red";
}) {
  return (
    <div className={`rounded-xl border bg-white p-4 ${accent === "red" ? "border-red-200" : "border-[var(--border)]"}`}>
      <div className="flex items-center gap-1.5 text-sm font-medium">
        <span className={accent === "red" ? "text-red-600" : "text-[var(--accent)]"}>{icon}</span>
        {title}
      </div>
      <div className="mt-1 text-xl font-semibold tabular">{value}</div>
      <div className="mt-1 space-y-0.5 text-[11px] text-[var(--muted)]">
        {lines.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </div>
  );
}
