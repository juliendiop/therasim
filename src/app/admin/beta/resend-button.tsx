"use client";

import { useActionState } from "react";
import { resendBetaInviteAction, type InviteResult } from "./actions";

/** Relance l'email d'invitation (envoi initial raté, email perdu…). */
export default function ResendButton({
  inviteId,
  alreadySent,
}: {
  inviteId: string;
  alreadySent: boolean;
}) {
  const [state, action, pending] = useActionState<InviteResult, FormData>(
    resendBetaInviteAction,
    null,
  );

  return (
    <form action={action} className="inline-block">
      <input type="hidden" name="inviteId" value={inviteId} />
      <button
        disabled={pending}
        title={state?.message ?? undefined}
        className={`rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
          state && !state.ok
            ? "border-red-300 text-red-700"
            : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
        }`}
      >
        {pending ? "…" : alreadySent ? "Renvoyer" : "Envoyer"}
      </button>
    </form>
  );
}
