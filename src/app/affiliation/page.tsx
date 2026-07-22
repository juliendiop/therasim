import Link from "next/link";
import { Gift, Users2, History, Megaphone, Download } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getAmbassadorStats,
  getReferralList,
  getCommissionHistory,
  getActivePayoutRequest,
  resolveCommissionRate,
} from "@/lib/affiliation";
import { AFFILIATION_ACTIVATION, AFFILIATION_DASHBOARD } from "@/lib/affiliation-copy";
import { KIT_BLOCKS, KIT_IMAGES, fillTemplate, KIT_DISCLAIMER } from "@/lib/affiliation-kit";
import { appBaseUrlFromRequest } from "@/lib/base-url";
import CopyPrompt from "@/app/admin/optimisation/copy-prompt";
import { activateAmbassadorAction } from "./actions";
import CopyLinkButton from "./copy-link-button";
import PayoutPanel from "./payout-panel";

export const dynamic = "force-dynamic";

const HISTORY_LABEL: Record<string, string> = {
  commission_sub_t1: "Commission (filleul direct)",
  commission_sub_t2: "Commission (niveau 2)",
  commission_school: "Commission école",
  payout: "Paiement",
  clawback: "Reprise (remboursement)",
  adjustment: "Ajustement",
};

function formatEuros(cents: number): string {
  return (cents / 100).toFixed(2).replace(".00", "") + " €";
}

function renderCopy(text: string, vars: { t1: number; t2: number; seuil: string }): string {
  return text
    .replaceAll("{T1}", String(vars.t1))
    .replaceAll("{T2}", String(vars.t2))
    .replaceAll("{SEUIL}", vars.seuil);
}

export default async function AffiliationPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const sessionUser = await requireUser();
  const { erreur } = await searchParams;

  const [user, rates] = await Promise.all([
    prisma.user.findUnique({ where: { id: sessionUser.id } }),
    resolveCommissionRate(),
  ]);
  if (!user) return null;

  const seuil = formatEuros(rates.payoutMinCents).replace(" €", "");
  const vars = { t1: rates.rateTier1, t2: rates.rateTier2, seuil };

  // --- Écran d'activation (pas encore ambassadeur) ---------------------------
  if (!user.referralCode) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-[var(--accent)]" />
          <h1 className="text-xl font-semibold">{AFFILIATION_ACTIVATION.h1}</h1>
        </div>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">{AFFILIATION_ACTIVATION.lead}</p>

        {erreur === "cgu" && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Merci d&apos;accepter les conditions du programme pour activer votre espace ambassadeur.
          </div>
        )}

        <ul className="mt-5 space-y-2">
          {AFFILIATION_ACTIVATION.benefits.map((b) => (
            <li key={b} className="flex gap-2 text-sm">
              <span className="text-[var(--accent)]">•</span>
              <span>{renderCopy(b, vars)}</span>
            </li>
          ))}
        </ul>

        <form action={activateAmbassadorAction} className="mt-6 rounded-xl border border-[var(--border)] bg-white p-4">
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" name="consent" required className="mt-1" />
            <span>{AFFILIATION_ACTIVATION.consentLabel}</span>
          </label>
          <p className="mt-2 text-xs text-[var(--muted)]">{AFFILIATION_ACTIVATION.consentHint}</p>
          <button className="mt-4 w-full rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] sm:w-auto">
            {AFFILIATION_ACTIVATION.cta}
          </button>
        </form>
      </div>
    );
  }

  // --- Espace ambassadeur ------------------------------------------------------
  const baseUrl = await appBaseUrlFromRequest();
  const referralLink = `${baseUrl}/r/${user.referralCode}`;

  const [stats, referrals, history, activePayout] = await Promise.all([
    getAmbassadorStats(user.id),
    getReferralList(user.id),
    getCommissionHistory(user.id),
    getActivePayoutRequest(user.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div className="flex items-center gap-2">
        <Gift className="h-5 w-5 text-[var(--accent)]" />
        <h1 className="text-xl font-semibold">{AFFILIATION_DASHBOARD.h1}</h1>
      </div>

      {/* Lien de parrainage */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          {AFFILIATION_DASHBOARD.linkSectionTitle}
        </h2>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">{AFFILIATION_DASHBOARD.linkSectionHint}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-white p-4">
          <code className="flex-1 truncate text-sm">{referralLink}</code>
          <CopyLinkButton text={referralLink} />
        </div>
      </section>

      {/* Revenus */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          {AFFILIATION_DASHBOARD.statsTitle}
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-4 sm:col-span-3">
            <div className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
              {AFFILIATION_DASHBOARD.stats.balance}
            </div>
            <div className="mt-1 text-3xl font-bold text-[var(--accent)]">
              {formatEuros(stats.balanceCents)}
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">{AFFILIATION_DASHBOARD.stats.balanceHint}</p>
          </div>
          <StatCard label={AFFILIATION_DASHBOARD.stats.totalEarned} value={formatEuros(stats.totalEarnedCents)} />
          <StatCard label={AFFILIATION_DASHBOARD.stats.totalPaid} value={formatEuros(stats.totalPaidCents)} />
          <StatCard label={AFFILIATION_DASHBOARD.stats.activeSubs} value={String(stats.activeReferredCount)} />
          <StatCard label={AFFILIATION_DASHBOARD.stats.tier1} value={String(stats.tier1Count)} />
          <StatCard label={AFFILIATION_DASHBOARD.stats.tier2} value={String(stats.tier2Count)} />
        </div>
      </section>

      {/* Paiement */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          {AFFILIATION_DASHBOARD.payoutTitle}
        </h2>
        <div className="mt-3">
          <PayoutPanel
            balanceCents={stats.balanceCents}
            payoutMinCents={rates.payoutMinCents}
            activeRequest={activePayout}
          />
        </div>
      </section>

      {/* Filleuls */}
      <section>
        <div className="flex items-center gap-2">
          <Users2 className="h-4 w-4 text-[var(--accent)]" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            {AFFILIATION_DASHBOARD.referralsTitle}
          </h2>
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">{AFFILIATION_DASHBOARD.referralsHint}</p>
        {referrals.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">{AFFILIATION_DASHBOARD.referralsEmpty}</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-tint)] text-left text-xs text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-2">Filleul</th>
                  <th className="px-4 py-2">Statut</th>
                  <th className="px-4 py-2 text-right">Commission générée</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {referrals.map((r) => (
                  <tr key={r.maskedId}>
                    <td className="px-4 py-2 font-medium">{r.maskedId}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.active
                            ? "bg-green-50 text-green-700"
                            : "bg-gray-100 text-[var(--muted)]"
                        }`}
                      >
                        {r.active ? "actif" : "inactif"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-semibold">
                      {formatEuros(r.commissionGeneratedCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Historique */}
      <section>
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-[var(--accent)]" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            {AFFILIATION_DASHBOARD.historyTitle}
          </h2>
        </div>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">Aucun mouvement pour l&apos;instant.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-[var(--border)]">
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="px-4 py-2">{HISTORY_LABEL[h.reason] ?? h.reason}</td>
                    <td className="px-4 py-2 text-xs text-[var(--muted)]">
                      {h.createdAt.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-semibold ${
                        h.delta >= 0 ? "text-green-700" : "text-[var(--foreground)]"
                      }`}
                    >
                      {h.delta >= 0 ? "+" : ""}
                      {formatEuros(h.delta)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Kit de diffusion */}
      <section>
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-[var(--accent)]" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            {AFFILIATION_DASHBOARD.kitTitle}
          </h2>
        </div>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">{AFFILIATION_DASHBOARD.kitHint}</p>
        <p className="mt-2 rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)] p-3 text-xs text-[var(--accent)]">
          {KIT_DISCLAIMER}
        </p>

        <div className="mt-4 space-y-4">
          {KIT_BLOCKS.map((block) => {
            const body = fillTemplate(block.body, { lien: referralLink, prenom: user.firstName ?? "" });
            const full = block.subject ? `Objet : ${block.subject}\n\n${body}` : body;
            return (
              <div key={block.id} className="rounded-xl border border-[var(--border)] bg-white p-4">
                <div className="flex items-center justify-between">
                  <b className="text-sm">{block.label}</b>
                  <span className="rounded-full bg-[var(--surface-tint)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
                    {block.channel}
                  </span>
                </div>
                <CopyPrompt text={full} />
              </div>
            );
          })}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {KIT_IMAGES.map((img) => (
            <div key={img.id} className="rounded-xl border border-[var(--border)] bg-white p-4">
              {/* Aperçus SVG : pas de dimensions fixes utiles côté next/image (vecteur). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.src}
                alt={img.label}
                className="max-h-40 w-full rounded-lg border border-[var(--border)] object-contain"
              />
              <div className="mt-2 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{img.label}</div>
                  <div className="text-xs text-[var(--muted)]">{img.usage}</div>
                </div>
                <a
                  href={img.src}
                  download
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium hover:border-[var(--accent)]"
                >
                  <Download className="h-3.5 w-3.5" /> Télécharger
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="text-xs text-[var(--muted)]">
        Vous êtes un tiers indépendant : pour être payé, vous devez pouvoir émettre une facture
        (ex. micro-entrepreneur). MELETA ne vous emploie pas.{" "}
        <Link href="/ambassadeurs" className="underline hover:text-[var(--accent)]">
          En savoir plus sur le programme
        </Link>
        .
      </p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}
