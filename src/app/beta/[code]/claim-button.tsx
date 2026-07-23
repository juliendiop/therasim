"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";
import { claimBetaInviteAction, type ClaimState } from "./actions";

/** Bouton unique d'activation. Le succès n'affiche rien : l'action redirige. */
export default function ClaimButton({ code }: { code: string }) {
  const [state, action, pending] = useActionState<ClaimState, FormData>(
    claimBetaInviteAction,
    null,
  );

  return (
    <div>
      <form action={action}>
        <input type="hidden" name="code" value={code} />
        <button
          disabled={pending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-50 sm:w-auto"
        >
          <Sparkles className="h-4 w-4" />
          {pending ? "Activation…" : "Activer mon accès bêta"}
        </button>
      </form>

      {state && !state.ok && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {state.message}
        </p>
      )}
    </div>
  );
}
