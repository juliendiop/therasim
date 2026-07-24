"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { submitBilanAction, type BilanFormState } from "./actions";
import { BILAN_QUESTIONS, BILAN_ANSWER_MAX } from "@/lib/beta-bilan-constants";

export default function BilanForm() {
  const [state, action, pending] = useActionState<BilanFormState, FormData>(
    submitBilanAction,
    null,
  );

  if (state?.ok) {
    return (
      <div className="mt-5">
        <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          Merci infiniment. Votre bilan pèse directement sur les prochaines évolutions de MELETA.
        </p>
        <Link
          href="/accueil"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
        >
          Retour à mon espace <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="mt-5 space-y-4">
      {BILAN_QUESTIONS.map((question, i) => (
        <div key={i}>
          <label className="text-sm font-medium">
            {i + 1}. {question}
          </label>
          <textarea
            name={`q${i + 1}`}
            rows={3}
            maxLength={BILAN_ANSWER_MAX}
            className="mt-1 w-full rounded-lg border border-[var(--border)] p-2.5 text-sm"
            placeholder="Votre réponse…"
          />
        </div>
      ))}

      {/* NPS 0-10 */}
      <fieldset>
        <legend className="text-sm font-medium">
          Sur une échelle de 0 à 10, quelle est la probabilité que vous recommandiez MELETA à un
          collègue ?
        </legend>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {Array.from({ length: 11 }, (_, n) => (
            <label
              key={n}
              className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[var(--border)] text-sm has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--accent)] has-[:checked]:font-semibold has-[:checked]:text-white"
            >
              <input type="radio" name="nps" value={n} required className="sr-only" />
              {n}
            </label>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-[var(--muted)]">
          <span>Pas du tout probable</span>
          <span>Très probable</span>
        </div>
      </fieldset>

      <div>
        <label className="text-sm font-medium">Pourquoi cette note ?</label>
        <textarea
          name="npsWhy"
          rows={2}
          maxLength={BILAN_ANSWER_MAX}
          className="mt-1 w-full rounded-lg border border-[var(--border)] p-2.5 text-sm"
          placeholder="Ce qui justifie votre note…"
        />
      </div>

      {state && !state.ok && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {state.message}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <Link
          href="/accueil"
          className="text-sm text-[var(--muted)] underline hover:text-[var(--foreground)]"
        >
          Plus tard
        </Link>
        <button
          disabled={pending}
          className="rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {pending ? "Envoi…" : "Envoyer mon bilan"}
        </button>
      </div>
    </form>
  );
}
