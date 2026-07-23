import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getTicket } from "@/lib/support";
import { TICKET_TYPE_LABEL, TICKET_STATUS_LABEL } from "@/lib/support-types";
import ReplyForm from "./reply-form";

export const dynamic = "force-dynamic";

function fmt(d: Date): string {
  return d.toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function SupportThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  // Cloisonnement : `forUserId` filtre à la lecture. Un ticket qui ne lui appartient
  // pas est indistinguable d'un ticket inexistant.
  const ticket = await getTicket(id, user.id);
  if (!ticket) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/support"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Mes demandes
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[var(--surface-tint)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
          {TICKET_TYPE_LABEL[ticket.type]}
        </span>
        {ticket.status === "closed" && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
            {TICKET_STATUS_LABEL.closed}
          </span>
        )}
      </div>
      <h1 className="mt-1.5 text-xl font-semibold">{ticket.subject}</h1>

      <div className="mt-5 space-y-3">
        {ticket.messages.map((m) => {
          const mine = m.authorRole === "client";
          return (
            <div
              key={m.id}
              className={`rounded-xl border p-4 ${
                mine
                  ? "border-[var(--border)] bg-white"
                  : "border-[var(--accent-border)] bg-[var(--accent-soft)]"
              }`}
            >
              <div className="text-xs font-medium text-[var(--muted)]">
                {mine ? "Vous" : "MELETA"} · {fmt(m.createdAt)}
              </div>
              <p className="mt-1.5 whitespace-pre-line text-sm">{m.body}</p>
            </div>
          );
        })}
      </div>

      {ticket.status === "open" ? (
        <ReplyForm ticketId={ticket.id} />
      ) : (
        <p className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--surface-tint)] p-4 text-sm text-[var(--muted)]">
          Cette demande est close. Si le sujet revient, ouvre une nouvelle demande depuis le
          bouton <b>Aide</b>.
        </p>
      )}
    </div>
  );
}
