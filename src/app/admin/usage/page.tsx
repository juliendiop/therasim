import { Gauge, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { usageSettings } from "@/lib/usage-limits";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

// Consommation IA (mises en situation) par utilisateur — suivi de l'usage loyal.
// Les plafonds sont des garde-fous anti-abus, pas des limites de produit : cette page
// sert à repérer un usage atypique, pas à rationner un usage normal.
export default async function AdminUsagePage() {
  const s = await usageSettings();
  const since30 = new Date(Date.now() - 30 * DAY_MS);
  const since1 = new Date(Date.now() - DAY_MS);

  const [byUser30, byUser1, total30] = await Promise.all([
    prisma.simSession.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: since30 } },
      _count: true,
      orderBy: { _count: { userId: "desc" } },
      take: 50,
    }),
    prisma.simSession.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: since1 } },
      _count: true,
    }),
    prisma.simSession.count({ where: { createdAt: { gte: since30 } } }),
  ]);

  const today = new Map(byUser1.map((r) => [r.userId, r._count]));
  const users = await prisma.user.findMany({
    where: { id: { in: byUser30.map((r) => r.userId) } },
    select: { id: true, email: true },
  });
  const emailById = new Map(users.map((u) => [u.id, u.email]));

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-[var(--accent)]" />
          <h2 className="text-lg font-semibold">Consommation IA</h2>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          Mises en situation (mini-scènes + entretiens) lancées par utilisateur. Les plafonds
          ci-dessous sont des garde-fous anti-abus, jamais des limites de produit — l&apos;usage
          normal ne doit jamais les atteindre. Réglables dans « Crédits &amp; quotas ».
        </p>
      </div>

      {/* Plafonds en vigueur */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label="Plafond / jour" value={s.simDaily} hint="mises en situation / utilisateur" />
        <Card label="Filet / mois" value={s.simMonthly} hint="dernier recours, très haut" />
        <Card label="Alerte admin" value={s.simAlert} hint="email au franchissement (30 j)" />
        <Card label="Drills notés / jour" value={s.drillDaily} hint="évaluations IA gratuites" />
      </div>

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Top consommateurs — 30 derniers jours ({total30} au total)
        </h3>
        {byUser30.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-[var(--border)] bg-white p-6 text-center text-sm text-[var(--muted)]">
            Aucune mise en situation sur les 30 derniers jours.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-tint)] text-left text-xs text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-2">Utilisateur</th>
                  <th className="px-4 py-2 text-right">30 jours</th>
                  <th className="px-4 py-2 text-right">24 h</th>
                  <th className="px-4 py-2 text-right">État</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {byUser30.map((r) => {
                  const alert = r._count >= s.simAlert;
                  const dayCount = today.get(r.userId) ?? 0;
                  return (
                    <tr key={r.userId}>
                      <td className="px-4 py-2 font-medium">
                        {emailById.get(r.userId) ?? r.userId}
                      </td>
                      <td className="px-4 py-2 text-right tabular font-semibold">{r._count}</td>
                      <td
                        className={`px-4 py-2 text-right tabular ${
                          dayCount >= s.simDaily ? "font-semibold text-amber-700" : ""
                        }`}
                      >
                        {dayCount}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {alert ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            <AlertTriangle className="h-3 w-3" /> à surveiller
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--muted)]">normal</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Card({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-4">
      <div className="text-2xl font-semibold tabular">{value}</div>
      <div className="text-xs font-medium">{label}</div>
      <div className="text-[11px] text-[var(--muted)]">{hint}</div>
    </div>
  );
}
