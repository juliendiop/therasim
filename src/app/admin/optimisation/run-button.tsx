"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";
import { runAnalysisAction } from "./actions";

type Result = { error: string | null };

/** Bouton « Lancer l'analyse » : appelle l'IA, affiche l'état de chargement. */
export default function RunButton({ hasPrevious }: { hasPrevious: boolean }) {
  const [state, action, pending] = useActionState<Result | null, FormData>(
    async () => runAnalysisAction(),
    null,
  );

  return (
    <div>
      <form action={action}>
        <button
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-60"
        >
          <Sparkles className="h-4 w-4" />
          {pending
            ? "Analyse en cours…"
            : hasPrevious
              ? "Relancer l'analyse"
              : "Lancer l'analyse"}
        </button>
      </form>
      {pending && (
        <p className="mt-2 text-xs text-[var(--muted)]">
          L&apos;IA lit vos mesures d&apos;entonnoir et rédige ses recommandations — quelques
          secondes.
        </p>
      )}
      {state?.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
    </div>
  );
}
