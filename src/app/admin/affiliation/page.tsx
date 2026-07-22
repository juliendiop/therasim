import { Gift, Settings, Users, Wallet } from "lucide-react";
import { listAmbassadors, listOpenPayoutRequests, resolveCommissionRate } from "@/lib/affiliation";
import {
  saveAffiliationSettings,
  markPayoutPaidAction,
  rejectPayoutAction,
} from "./actions";
import SchoolCommissionForm from "./school-commission-form";
import AdjustForm from "./adjust-form";

export const dynamic = "force-dynamic";

const PAYOUT_STATUS_LABEL: Record<string, string> = {
  pending: "en attente de facture",
  invoice_received: "facture reçue",
};

function formatEuros(cents: number): string {
  return (cents / 100).toFixed(2).replace(".00", "") + " €";
}

export default async function AdminAffiliationPage() {
  const [rates, ambassadors, payoutRequests] = await Promise.all([
    resolveCommissionRate(),
    listAmbassadors(),
    listOpenPayoutRequests(),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-[var(--accent)]" />
          <h2 className="text-lg font-semibold">Programme d&apos;affiliation « Ambassadeurs »</h2>
        </div>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Commission récurrente à vie sur 2 niveaux, versée sur demande (facture par email).
        </p>
      </div>

      {/* Demandes de paiement */}
      <section>
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-[var(--accent)]" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Demandes de paiement
          </h3>
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-tint)] text-left text-xs text-[var(--muted)]">
              <tr>
                <th className="px-4 py-2">Ambassadeur</th>
                <th className="px-4 py-2 text-right">Montant</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {payoutRequests.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted)]">
                    Aucune demande en cours.
                  </td>
                </tr>
              ) : (
                payoutRequests.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 font-medium">{r.ambassadorEmail}</td>
                    <td className="px-4 py-2 text-right font-semibold tabular">
                      {formatEuros(r.amountCents)}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.status === "invoice_received"
                            ? "bg-green-50 text-green-700"
                            : "bg-[var(--accent-soft)] text-[var(--accent)]"
                        }`}
                      >
                        {PAYOUT_STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-[var(--muted)]">
                      {r.createdAt.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-2">
                        <form action={markPayoutPaidAction}>
                          <input type="hidden" name="payoutRequestId" value={r.id} />
                          <button className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--accent-hover)]">
                            Marquer payé
                          </button>
                        </form>
                        <form action={rejectPayoutAction}>
                          <input type="hidden" name="payoutRequestId" value={r.id} />
                          <button className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:border-red-300 hover:text-red-700">
                            Rejeter
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Ambassadeurs */}
      <section>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[var(--accent)]" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Ambassadeurs
          </h3>
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-tint)] text-left text-xs text-[var(--muted)]">
              <tr>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Code</th>
                <th className="px-4 py-2 text-right">Filleuls n1</th>
                <th className="px-4 py-2 text-right">Filleuls n2</th>
                <th className="px-4 py-2 text-right">Total gagné</th>
                <th className="px-4 py-2 text-right">Solde</th>
                <th className="px-4 py-2 text-right">Total payé</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {ambassadors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--muted)]">
                    Aucun ambassadeur pour l&apos;instant.
                  </td>
                </tr>
              ) : (
                ambassadors.map((a) => (
                  <tr key={a.userId}>
                    <td className="px-4 py-2 font-medium">{a.email}</td>
                    <td className="px-4 py-2 text-xs text-[var(--muted)]">{a.referralCode}</td>
                    <td className="px-4 py-2 text-right tabular">{a.tier1Count}</td>
                    <td className="px-4 py-2 text-right tabular">{a.tier2Count}</td>
                    <td className="px-4 py-2 text-right tabular">{formatEuros(a.totalEarnedCents)}</td>
                    <td className="px-4 py-2 text-right font-semibold tabular text-[var(--accent)]">
                      {formatEuros(a.balanceCents)}
                    </td>
                    <td className="px-4 py-2 text-right tabular">{formatEuros(a.totalPaidCents)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Triés par solde décroissant — pratique pour repérer qui est à payer.
        </p>
      </section>

      {/* Commission école (manuelle) */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Commission école (manuelle)
        </h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Quand une école mentionne le nom d&apos;un ambassadeur et signe, créditez la commission
          ici — répétable à chaque renouvellement du contrat.
        </p>
        <div className="mt-3">
          <SchoolCommissionForm />
        </div>
      </section>

      {/* Ajustement manuel */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Ajustement manuel
        </h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Corriger une erreur de solde (montant positif ou négatif).
        </p>
        <div className="mt-3">
          <AdjustForm />
        </div>
      </section>

      {/* Réglages */}
      <section>
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-[var(--accent)]" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Réglages
          </h3>
        </div>
        <form
          action={saveAffiliationSettings}
          className="mt-3 grid gap-4 rounded-xl border border-[var(--border)] bg-white p-4 sm:grid-cols-2"
        >
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="enabled" defaultChecked={rates.enabled} />
            Programme actif
          </label>
          <div>
            <label className="text-xs font-medium">Taux niveau 1 (%)</label>
            <input
              name="rateTier1"
              type="number"
              min={0}
              max={100}
              step="0.1"
              defaultValue={rates.rateTier1}
              className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium">Taux niveau 2 (%)</label>
            <input
              name="rateTier2"
              type="number"
              min={0}
              max={100}
              step="0.1"
              defaultValue={rates.rateTier2}
              className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium">Seuil de paiement (€)</label>
            <input
              name="payoutMinEuros"
              type="number"
              min={0}
              step="0.01"
              defaultValue={(rates.payoutMinCents / 100).toFixed(2)}
              className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium">Durée du cookie d&apos;attribution (jours)</label>
            <input
              name="cookieDays"
              type="number"
              min={1}
              defaultValue={rates.cookieDays}
              className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <button className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]">
              Enregistrer
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
