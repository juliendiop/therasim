"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { submitTestimonialAction, type TestimonialFormState } from "./actions";
import {
  TESTIMONIAL_PROMPTS,
  TESTIMONIAL_DISPLAY_MODES,
  TESTIMONIAL_TEXT_MAX,
} from "@/lib/beta-bilan-constants";

const FIELD_NAMES = ["before", "during", "after"] as const;

export default function TemoignageForm() {
  const [state, action, pending] = useActionState<TestimonialFormState, FormData>(
    submitTestimonialAction,
    null,
  );
  const [mode, setMode] = useState<string>("name_profession");

  if (state?.ok) {
    return (
      <div className="mt-5">
        <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          Merci ! Votre témoignage m&apos;est parvenu. Rien ne sera publié sans votre accord —
          je reviens vers vous si je souhaite le mettre en avant.
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
      {TESTIMONIAL_PROMPTS.map((prompt, i) => (
        <div key={i}>
          <label className="text-sm font-medium">{prompt}</label>
          <textarea
            name={FIELD_NAMES[i]}
            rows={2}
            maxLength={TESTIMONIAL_TEXT_MAX}
            className="mt-1 w-full rounded-lg border border-[var(--border)] p-2.5 text-sm"
            placeholder="Complétez cette phrase…"
          />
        </div>
      ))}

      <fieldset>
        <legend className="text-sm font-medium">Comment souhaitez-vous être présenté ?</legend>
        <div className="mt-2 space-y-1.5">
          {TESTIMONIAL_DISPLAY_MODES.map((m) => (
            <label key={m.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="displayMode"
                value={m.value}
                checked={mode === m.value}
                onChange={() => setMode(m.value)}
              />
              {m.label}
            </label>
          ))}
        </div>
      </fieldset>

      {mode === "name_profession" && (
        <div>
          <label className="text-sm font-medium">Votre profession (facultatif)</label>
          <input
            name="profession"
            maxLength={80}
            className="mt-1 w-full rounded-lg border border-[var(--border)] p-2.5 text-sm"
            placeholder="ex. psychologue clinicienne"
          />
        </div>
      )}

      <p className="text-xs text-[var(--muted)]">
        Rien ne sera publié sans votre accord explicite. Vous pourrez demander le retrait à tout
        moment.
      </p>

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
          {pending ? "Envoi…" : "Envoyer mon témoignage"}
        </button>
      </div>
    </form>
  );
}
