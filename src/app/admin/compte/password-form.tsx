"use client";

import { useActionState } from "react";
import { setMyPassword, type PwResult } from "./actions";

export default function PasswordForm() {
  const [state, action, pending] = useActionState<PwResult | null, FormData>(
    setMyPassword,
    null,
  );

  return (
    <form action={action} className="mt-3 space-y-3 rounded-xl border border-[var(--border)] bg-white p-4">
      <div>
        <label className="text-xs font-medium">Nouveau mot de passe</label>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          placeholder="8 caractères minimum"
          className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-medium">Confirmer</label>
        <input
          type="password"
          name="confirm"
          required
          className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
        />
      </div>
      <button
        disabled={pending}
        className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
      >
        {pending ? "Enregistrement…" : "Enregistrer le mot de passe"}
      </button>
      {state && (
        <p className={`text-sm ${state.ok ? "text-green-700" : "text-red-600"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
