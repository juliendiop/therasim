import Link from "next/link";
import { ArrowRight, LifeBuoy } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listUserTickets } from "@/lib/support";
import { TICKET_TYPE_LABEL, TICKET_STATUS_LABEL } from "@/lib/support-types";

export const dynamic = "force-dynamic";

function fmt(d: Date): string {
  return d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
}

export default async function SupportListPage() {
  const user = await requireUser();
  const tickets = await listUserTickets(user.id);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-2">
        <LifeBuoy className="h-5 w-5 text-[var(--accent)]" />
        <h1 className="text-xl font-semibold">Mes demandes</h1>
      </div>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Pour en ouvrir une nouvelle, utilise le bouton <b>Aide</b> en haut de page — depuis
        n&apos;importe où dans l&apos;application.
      </p>

      {tickets.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-[var(--border)] bg-white p-8 text-center text-sm text-[var(--muted)]">
          Aucune demande pour l&apos;instant.
        </p>
      ) : (
        <ul className="mt-5 space-y-2">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link
                href={`/support/${t.id}`}
                className="group flex items-center gap-3 rounded-xl border border-[var(--border)] bg-white p-4 transition hover:border-[var(--accent)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[var(--surface-tint)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
                      {TICKET_TYPE_LABEL[t.type]}
                    </span>
                    {t.status === "closed" && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
                        {TICKET_STATUS_LABEL.closed}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 truncate font-medium group-hover:text-[var(--accent)]">
                    {t.subject}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    dernière activité le {fmt(t.lastMessageAt)}
                    {t.lastMessageFrom === "admin" && t.status === "open" && " · réponse reçue"}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
