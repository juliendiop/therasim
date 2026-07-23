"use client";

import { useActionState } from "react";
import { replyToTicketAction, type SupportFormState } from "../actions";
import { BODY_MAX } from "@/lib/support-types";

export default function ReplyForm({ ticketId }: { ticketId: string }) {
  const [state, action, pending] = useActionState<SupportFormState, FormData>(
    replyToTicketAction,
    null,
  );

  return (
    <form action={action} className="mt-4">
      <input type="hidden" name="ticketId" value={ticketId} />
      <textarea
        name="body"
        required
        rows={4}
        maxLength={BODY_MAX}
        placeholder="Ajouter un message…"
        className="w-full rounded-lg border border-[var(--border)] p-2.5 text-sm"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        {state && (
          <p className={`text-sm ${state.ok ? "text-green-700" : "text-red-700"}`}>
            {state.message}
          </p>
        )}
        <button
          disabled={pending}
          className="ml-auto rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {pending ? "Envoi…" : "Envoyer"}
        </button>
      </div>
    </form>
  );
}
