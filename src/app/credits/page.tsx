import Link from "next/link";
import { Coins, History, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  CREDIT_PACKS,
  creditSettings,
  syncWallet,
} from "@/lib/credits";

export const dynamic = "force-dynamic";

const REASON_LABEL: Record<string, string> = {
  welcome: "Pack de bienvenue",
  monthly: "Recharge mensuelle",
  consume_miniscene: "Mini-scène",
  consume_simulation: "Entretien simulé",
  refund: "Remboursement",
  admin_grant: "Crédits offerts",
  purchase: "Achat de crédits",
};

export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ need?: string; soon?: string }>;
}) {
  const user = await requireUser();
  const { need, soon } = await searchParams;

  const [balance, settings, history] = await Promise.all([
    syncWallet(user.id),
    creditSettings(),
    prisma.creditLedger.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-2">
        <Coins className="h-5 w-5 text-[var(--accent)]" />
        <h1 className="text-xl font-semibold">Mes crédits</h1>
      </div>

      {need && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Vous n&apos;avez plus assez de crédits pour lancer{" "}
          {need === "simulation" ? "un entretien simulé" : "une mini-scène"}. Rechargez votre
          solde pour continuer à vous entraîner.
        </div>
      )}
      {soon && (
        <div className="mt-4 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-4 text-sm">
          Le paiement en ligne arrive très bientôt. En attendant, votre administrateur peut
          créditer votre compte — n&apos;hésitez pas à le contacter.
        </div>
      )}

      {/* Solde */}
      <div className="mt-4 flex items-center justify-between rounded-xl border border-[var(--border)] bg-white p-5">
        <div>
          <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Solde actuel</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-[var(--accent)]">{balance}</span>
            <span className="text-sm text-[var(--muted)]">crédit{balance > 1 ? "s" : ""}</span>
          </div>
        </div>
        <div className="text-right text-xs text-[var(--muted)]">
          <p>Mini-scène : <b>{settings.costMiniscene}</b> crédit{settings.costMiniscene > 1 ? "s" : ""}</p>
          <p>Entretien simulé : <b>{settings.costSimulation}</b> crédits</p>
          <p className="mt-1">Exercices (QCM) : <b>gratuits</b></p>
        </div>
      </div>

      {/* Recharge mensuelle */}
      <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--muted)]">
        <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
        Vous recevez {settings.monthly} crédits gratuits chaque mois.
      </p>

      {/* Packs */}
      <h2 className="mt-7 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        Recharger
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {CREDIT_PACKS.map((p) => (
          <div
            key={p.id}
            className="flex flex-col rounded-xl border border-[var(--border)] bg-white p-4 text-center"
          >
            <div className="text-2xl font-bold">{p.credits}</div>
            <div className="text-xs text-[var(--muted)]">crédits</div>
            <div className="mt-2 text-sm font-semibold">{p.priceEur} €</div>
            <Link
              href={`/credits?soon=${p.id}`}
              className="mt-3 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
            >
              Acheter
            </Link>
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-[11px] text-[var(--muted)]">
        Prix indicatifs · paiement en ligne disponible prochainement.
      </p>

      {/* Historique */}
      <h2 className="mt-7 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        <History className="h-4 w-4" /> Historique
      </h2>
      {history.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">Aucun mouvement pour l&apos;instant.</p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)] bg-white">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-[var(--border)]">
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="px-4 py-2">{REASON_LABEL[h.reason] ?? h.reason}</td>
                  <td className="px-4 py-2 text-xs text-[var(--muted)]">
                    {h.createdAt.toLocaleDateString("fr-FR")}
                  </td>
                  <td
                    className={`px-4 py-2 text-right font-semibold ${
                      h.delta >= 0 ? "text-green-700" : "text-[var(--foreground)]"
                    }`}
                  >
                    {h.delta >= 0 ? `+${h.delta}` : h.delta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
