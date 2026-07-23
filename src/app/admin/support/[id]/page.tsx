import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getTicket } from "@/lib/support";
import { TICKET_TYPE_LABEL, TICKET_STATUS_LABEL } from "@/lib/support-types";
import { toggleTicketStatusAction } from "../actions";
import AssistPanel from "./assist-panel";

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

export default async function AdminTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // La garde super-admin est portée par le layout /admin (requireSuperAdmin).
  const ticket = await getTicket(id);
  if (!ticket) notFound();

  const client = await prisma.user.findUnique({ where: { id: ticket.userId } });
  const ctx = ticket.context;
  const closed = ticket.status === "closed";

  return (
    <div className="space-y-5">
      <Link
        href="/admin/support"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Toutes les demandes
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--surface-tint)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
              {TICKET_TYPE_LABEL[ticket.type]}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                closed ? "bg-gray-100 text-[var(--muted)]" : "bg-[var(--accent-soft)] text-[var(--accent)]"
              }`}
            >
              {TICKET_STATUS_LABEL[ticket.status]}
            </span>
            {ticket.awaitingAdmin && (
              <span className="rounded-full bg-[var(--ochre)]/15 px-2 py-0.5 text-[11px] font-medium text-[var(--ochre)]">
                en attente de ta réponse
              </span>
            )}
          </div>
          <h2 className="mt-1.5 text-lg font-semibold">{ticket.subject}</h2>
          <p className="text-sm text-[var(--muted)]">
            {client?.email ?? "compte supprimé"} · ouverte le {fmt(ticket.createdAt)}
          </p>
        </div>

        <form action={toggleTicketStatusAction}>
          <input type="hidden" name="ticketId" value={ticket.id} />
          <input type="hidden" name="next" value={closed ? "open" : "closed"} />
          <button className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:border-[var(--accent)] hover:text-[var(--accent)]">
            {closed ? "Rouvrir" : "Clore"}
          </button>
        </form>
      </div>

      {/* Contexte technique — relevé automatiquement, visible ICI uniquement
          (volontairement absent des emails de notification). */}
      <div className="rounded-xl border border-[var(--border)] bg-white p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Contexte technique
        </h3>
        {ctx ? (
          <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <Row label="Page" value={ctx.page} />
            <Row label="Forfait" value={ctx.plan ?? "aucun"} />
            <Row label="Abonnement" value={ctx.subscriptionStatus ?? "—"} />
            <Row label="Crédits" value={ctx.credits === null ? "—" : String(ctx.credits)} />
            <Row label="Version" value={ctx.appVersion} />
            <Row label="Navigateur" value={ctx.userAgent} />
          </dl>
        ) : (
          <p className="mt-1 text-sm text-[var(--muted)]">Non relevé.</p>
        )}
      </div>

      {/* Fil */}
      <div className="space-y-3">
        {ticket.messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-xl border p-4 ${
              m.authorRole === "admin"
                ? "border-[var(--accent-border)] bg-[var(--accent-soft)]"
                : "border-[var(--border)] bg-white"
            }`}
          >
            <div className="text-xs font-medium text-[var(--muted)]">
              {m.authorRole === "admin" ? "Toi" : "Client"} · {fmt(m.createdAt)}
            </div>
            <p className="mt-1.5 whitespace-pre-line text-sm">{m.body}</p>
          </div>
        ))}
      </div>

      <AssistPanel ticketId={ticket.id} closed={closed} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-[var(--muted)]">{label} :</dt>
      <dd className="min-w-0 break-words">{value ?? "—"}</dd>
    </div>
  );
}
