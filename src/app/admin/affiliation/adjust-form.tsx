"use client";

import { useActionState } from "react";
import { adjustCommissionAction, type CreditResult } from "./actions";

export default function AdjustForm() {
  const [state, action, pending] = useActionState<CreditResult | null, FormData>(
    adjustCommissionAction,
    null,
  );

  return (
    <div>
      <form
        action={action}
        className="grid gap-3 rounded-xl border border-[var(--border)] bg-white p-4 sm:grid-cols-[1fr_auto_2fr_auto]"
      >
        <div>
          <label className="text-xs font-medium">Email de l&apos;ambassadeur</label>
          <input
            name="email"
            type="email"
            required
            placeholder="ambassadeur@exemple.fr"
            className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Montant (€, +/-)</label>
          <input
            name="amountEuros"
            type="number"
            step="0.01"
            placeholder="ex. -10 ou 25"
            className="mt-1 w-28 rounded-lg border border-[var(--border)] p-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Note (raison de la correction)</label>
          <input
            name="note"
            placeholder="ex. Correction erreur commission facture #123"
            className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
          />
        </div>
        <div className="flex items-end">
          <button
            disabled={pending}
            className="w-full rounded-lg border border-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-50 sm:w-auto"
          >
            {pending ? "…" : "Ajuster"}
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
