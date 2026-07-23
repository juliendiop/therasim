import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { listAllTickets } from "@/lib/support";
import { TICKET_TYPE_LABEL, TICKET_STATUS_LABEL } from "@/lib/support-types";

export const dynamic = "force-dynamic";

function fmt(d: Date): string {
  return d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
}

export default async function AdminSupportPage() {
  const tickets = await listAllTickets();
  const waiting = tickets.filter((t) => t.awaitingAdmin).length;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <LifeBuoy className="h-5 w-5 text-[var(--accent)]" />
          <h2 className="text-lg font-semibold">Support client</h2>
        </div>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Trié par dernière activité. Un point ocre signale les demandes dont le dernier
          message vient du client — celles qui attendent ta réponse.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm">
        <b>{waiting}</b> demande{waiting > 1 ? "s" : ""} en attente de ta réponse ·{" "}
        {tickets.length} au total
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-tint)] text-left text-xs text-[var(--muted)]">
            <tr>
              <th className="px-4 py-2 w-6"></th>
              <th className="px-4 py-2">Sujet</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Client</th>
              <th className="px-4 py-2">Statut</th>
              <th className="px-4 py-2">Dernière activité</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {tickets.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--muted)]">
                  Aucune demande pour l&apos;instant.
                </td>
              </tr>
            ) : (
              tickets.map((t) => (
                <tr key={t.id} className={t.awaitingAdmin ? "bg-[var(--accent-soft)]/40" : ""}>
                  <td className="px-4 py-2">
                    {t.awaitingAdmin && (
                      <span
                        title="En attente de ta réponse"
                        className="block h-2 w-2 rounded-full bg-[var(--ochre)]"
                      />
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/support/${t.id}`}
                      className="font-medium hover:text-[var(--accent)]"
                    >
                      {t.subject}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-xs text-[var(--muted)]">
                    {TICKET_TYPE_LABEL[t.type]}
                  </td>
                  <td className="px-4 py-2 text-xs text-[var(--muted)]">{t.email}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        t.status === "open"
                          ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                          : "bg-gray-100 text-[var(--muted)]"
                      }`}
                    >
                      {TICKET_STATUS_LABEL[t.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-[var(--muted)]">
                    {fmt(t.lastMessageAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
