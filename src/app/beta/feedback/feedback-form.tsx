"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { submitFeedbackAction, type FeedbackFormState } from "./actions";
import { FEEDBACK_QUESTIONS, FEEDBACK_ANSWER_MAX } from "@/lib/beta-feedback-constants";

export default function FeedbackForm({ firstName }: { firstName: string | null }) {
  const [state, action, pending] = useActionState<FeedbackFormState, FormData>(
    submitFeedbackAction,
    null,
  );

  if (state?.ok) {
    return (
      <div className="mt-5">
        <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          Merci, c&apos;est bien reçu. Votre retour m&apos;aide directement à améliorer MELETA.
        </p>
        <Link
          href="/accueil"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
        >
          Reprendre l&apos;entraînement <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="mt-5 space-y-4">
      <p className="text-sm text-[var(--muted)]">
        {firstName ? `Bonjour ${firstName}, ` : ""}vous pouvez être très direct — une critique
        précise m&apos;est souvent plus utile qu&apos;un encouragement général. Répondez à ce
        qui vous parle, en une phrase ou en un paragraphe.
      </p>

      {FEEDBACK_QUESTIONS.map((question, i) => (
        <div key={i}>
          <label className="text-sm font-medium">
            {i + 1}. {question}
          </label>
          <textarea
            name={`q${i + 1}`}
            rows={3}
            maxLength={FEEDBACK_ANSWER_MAX}
            className="mt-1 w-full rounded-lg border border-[var(--border)] p-2.5 text-sm"
            placeholder="Votre réponse…"
          />
        </div>
      ))}

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
          {pending ? "Envoi…" : "Envoyer mes réponses"}
        </button>
      </div>
    </form>
  );
}
