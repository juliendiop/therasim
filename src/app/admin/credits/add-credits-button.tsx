"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { addUserCredits, type GrantResult } from "./actions";

/** Ajoute des crédits à un utilisateur, sans email. */
export default function AddCreditsButton({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState<GrantResult | null, FormData>(
    addUserCredits,
    null,
  );

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={action} className="flex items-center gap-1">
        <input type="hidden" name="userId" value={userId} />
        <input
          name="amount"
          type="number"
          min={1}
          defaultValue={10}
          className="w-16 rounded border border-[var(--border)] px-2 py-1 text-xs"
        />
        <button
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-xs font-medium text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" /> {pending ? "…" : "Crédits"}
        </button>
      </form>
      {state && (
        <span className={`text-[11px] ${state.ok ? "text-green-700" : "text-red-600"}`}>
          {state.message}
        </span>
      )}
    </div>
  );
}
