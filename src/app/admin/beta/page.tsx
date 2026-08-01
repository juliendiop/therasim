import Link from "next/link";
import { FlaskConical, MessageSquareHeart, ClipboardCheck, Quote } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { parseBetaInviteStatus, BETA_INVITE_STATUS_LABEL } from "@/lib/beta-status";
import { getBetaImprovements } from "@/lib/beta-bilan";
import { revokeBetaInviteAction, saveBetaImprovementsAction } from "./actions";
import InviteForm from "./invite-form";
import ResendButton from "./resend-button";

export const dynamic = "force-dynamic";

const SUB_STATUS_LABEL: Record<string, string> = {
  trialing: "essai en cours",
  active: "actif (payant)",
  past_due: "paiement en retard",
  canceled: "terminé",
  incomplete: "en attente",
};

function fmt(d: Date | null): string {
  return d ? d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }) : "—";
}

export default async function AdminBetaPage() {
  const [invites, improvements] = await Promise.all([
    prisma.betaInvite.findMany({ orderBy: [{ createdAt: "desc" }], take: 300 }),
    getBetaImprovements(),
  ]);

  // Utilisateurs et abonnements des invitations réclamées, en 2 requêtes plutôt
  // qu'une par ligne.
  const claimedIds = invites.map((i) => i.claimedByUserId).filter((v): v is string => Boolean(v));
  const [users, subs] = await Promise.all([
    claimedIds.length
      ? prisma.user.findMany({ where: { id: { in: claimedIds } } })
      : Promise.resolve([]),
    claimedIds.length
      ? prisma.userSubscription.findMany({ where: { userId: { in: claimedIds } } })
      : Promise.resolve([]),
  ]);
  const userById = new Map(users.map((u) => [u.id, u]));
  const subByUser = new Map(subs.map((s) => [s.userId, s]));

  const counts = invites.reduce<Record<string, number>>((acc, i) => {
    const s = parseBetaInviteStatus(i.status);
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-[var(--accent)]" />
          <h2 className="text-lg font-semibold">Bêta fermée</h2>
        </div>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Invitations à usage unique. Le forfait offert est résolu en base par sa clé
          (<code className="rounded bg-[var(--surface-tint)] px-1">intensif</code>) — son Price ID
          se règle dans Facturation.
        </p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm font-medium text-[var(--accent)]">
          <Link href="/admin/beta/feedback" className="inline-flex items-center gap-1.5 hover:underline">
            <MessageSquareHeart className="h-4 w-4" /> Impressions à chaud
          </Link>
          <Link href="/admin/beta/bilan" className="inline-flex items-center gap-1.5 hover:underline">
            <ClipboardCheck className="h-4 w-4" /> Bilans J+21
          </Link>
          <Link href="/admin/beta/temoignages" className="inline-flex items-center gap-1.5 hover:underline">
            <Quote className="h-4 w-4" /> Témoignages
          </Link>
        </div>
      </div>

      {/* Améliorations affichées dans l'email de bilan J+21 (masquées si vide). */}
      <form
        action={saveBetaImprovementsAction}
        className="rounded-xl border border-[var(--border)] bg-white p-4"
      >
        <label className="text-sm font-semibold">
          Améliorations concrètes (email de bilan J+21)
        </label>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          Une par ligne. Elles apparaissent dans l&apos;email de bilan. Laisser vide masque le
          paragraphe.
        </p>
        <textarea
          name="improvements"
          rows={3}
          defaultValue={improvements.join("\n")}
          placeholder={"Feedback plus précis sur les reformulations\nNouveau domaine « deuil »\n…"}
          className="mt-2 w-full rounded-lg border border-[var(--border)] p-2.5 text-sm"
        />
        <button className="mt-2 rounded-lg bg-[var(--accent)] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]">
          Enregistrer
        </button>
      </form>

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Inviter un praticien
        </h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Crée un code à usage unique et envoie l&apos;email d&apos;invitation dans la foulée.
          Pour un envoi en lot :{" "}
          <code className="rounded bg-[var(--surface-tint)] px-1">
            npm run beta:invites -- --send --from-file testeurs.txt
          </code>
        </p>
        <div className="mt-3">
          <InviteForm defaultCohort={invites[0]?.cohort ?? "beta-2026-01"} />
        </div>
      </section>

      <div className="flex flex-wrap gap-2 text-sm">
        {(["PENDING", "CLAIMED", "REVOKED", "EXPIRED"] as const).map((s) => (
          <span
            key={s}
            className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5"
          >
            {BETA_INVITE_STATUS_LABEL[s]} : <b>{counts[s] ?? 0}</b>
          </span>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-tint)] text-left text-xs text-[var(--muted)]">
            <tr>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Destinataire</th>
              <th className="px-4 py-2">Cohorte</th>
              <th className="px-4 py-2">Statut</th>
              <th className="px-4 py-2">Envoyée</th>
              <th className="px-4 py-2">Réclamée le</th>
              <th className="px-4 py-2">Abonnement</th>
              <th className="px-4 py-2">Fin d&apos;essai</th>
              <th className="px-4 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {invites.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-[var(--muted)]">
                  Aucune invitation. Générez-en avec{" "}
                  <code className="rounded bg-[var(--surface-tint)] px-1">
                    npm run beta:invites -- --count 25
                  </code>
                </td>
              </tr>
            ) : (
              invites.map((invite) => {
                const status = parseBetaInviteStatus(invite.status);
                const user = invite.claimedByUserId
                  ? userById.get(invite.claimedByUserId)
                  : undefined;
                const sub = invite.claimedByUserId
                  ? subByUser.get(invite.claimedByUserId)
                  : undefined;
                const expired = invite.expiresAt.getTime() <= Date.now();

                return (
                  <tr key={invite.id}>
                    <td className="px-4 py-2 font-mono text-xs">{invite.code}</td>
                    <td className="px-4 py-2">
                      {user?.email ?? invite.email ?? (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                      {invite.note && (
                        <div className="text-xs text-[var(--muted)]">{invite.note}</div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-[var(--muted)]">{invite.cohort}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          status === "CLAIMED"
                            ? "bg-green-50 text-green-700"
                            : status === "PENDING" && !expired
                              ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                              : "bg-gray-100 text-[var(--muted)]"
                        }`}
                      >
                        {status === "PENDING" && expired
                          ? "expirée"
                          : BETA_INVITE_STATUS_LABEL[status]}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-[var(--muted)]">
                      {invite.emailSentAt ? (
                        fmt(invite.emailSentAt)
                      ) : (
                        <span className="text-[var(--ochre)]">non envoyée</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-[var(--muted)]">
                      {fmt(invite.claimedAt)}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {sub ? (
                        SUB_STATUS_LABEL[sub.status] ?? sub.status
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-[var(--muted)]">
                      {fmt(sub?.trialEndsAt ?? null)}
                    </td>
                    <td className="px-4 py-2">
                      {status === "PENDING" && !expired ? (
                        <div className="flex items-center justify-end gap-2">
                          {invite.email && (
                            <ResendButton
                              inviteId={invite.id}
                              alreadySent={Boolean(invite.emailSentAt)}
                            />
                          )}
                          <form action={revokeBetaInviteAction}>
                            <input type="hidden" name="inviteId" value={invite.id} />
                            <button className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:border-red-300 hover:text-red-700">
                              Révoquer
                            </button>
                          </form>
                        </div>
                      ) : (
                        <span className="block text-right text-xs text-[var(--muted)]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[var(--muted)]">
        Les codes expirés restent affichés « en attente / expirée » : c&apos;est le code qui
        expire (30 j par défaut), distinct de la durée de l&apos;essai, qui court à partir de la
        réclamation (réglable dans la configuration).
      </p>
    </div>
  );
}
