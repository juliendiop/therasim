"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { inviteBetaTesterAction, type InviteResult } from "./actions";

/** Crée une invitation nominative et l'envoie par email, en un geste. */
export default function InviteForm({ defaultCohort }: { defaultCohort: string }) {
  const [state, action, pending] = useActionState<InviteResult, FormData>(
    inviteBetaTesterAction,
    null,
  );

  return (
    <div>
      <form
        action={action}
        className="grid gap-3 rounded-xl border border-[var(--border)] bg-white p-4 sm:grid-cols-[2fr_1fr_1fr_auto]"
      >
        <div>
          <label className="text-xs font-medium">Email du praticien</label>
          <input
            name="email"
            type="email"
            required
            placeholder="marie@exemple.fr"
            className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Prénom (optionnel)</label>
          <input
            name="firstName"
            placeholder="Marie"
            className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Cohorte</label>
          <input
            name="cohort"
            defaultValue={defaultCohort}
            className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
          />
        </div>
        <div className="flex items-end">
          <button
            disabled={pending}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 sm:w-auto"
          >
            <Send className="h-4 w-4" />
            {pending ? "Envoi…" : "Inviter"}
          </button>
        </div>
      </form>

      {state && (
        <div
          className={`mt-3 rounded-lg border p-3 text-sm ${
            state.ok
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {state.message}
        </div>
      )}
    </div>
  );
}
