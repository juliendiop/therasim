"use client";

import { useActionState } from "react";
import { grantCredits, type GrantResult } from "./actions";

export default function GrantForm() {
  const [state, action, pending] = useActionState<GrantResult | null, FormData>(
    grantCredits,
    null,
  );

  return (
    <div>
      <form
        action={action}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--border)] bg-white p-4"
      >
        <div className="flex-1">
          <label className="text-xs font-medium">Email du bénéficiaire</label>
          <input
            name="email"
            type="email"
            required
            placeholder="therapeute@exemple.fr"
            className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Crédits</label>
          <input
            name="amount"
            type="number"
            min={1}
            defaultValue={10}
            className="mt-1 w-24 rounded-lg border border-[var(--border)] p-2 text-sm"
          />
        </div>
        <button
          disabled={pending}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {pending ? "…" : "Accorder"}
        </button>
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
