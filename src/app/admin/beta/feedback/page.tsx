import Link from "next/link";
import { ArrowLeft, MessageSquareHeart } from "lucide-react";
import { listBetaFeedback, FEEDBACK_QUESTIONS } from "@/lib/beta-feedback";

export const dynamic = "force-dynamic";

function fmt(d: Date): string {
  return d.toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" });
}

export default async function AdminBetaFeedbackPage() {
  const rows = await listBetaFeedback();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/beta"
          className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Bêta fermée
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <MessageSquareHeart className="h-5 w-5 text-[var(--accent)]" />
          <h2 className="text-lg font-semibold">Impressions à chaud ({rows.length})</h2>
        </div>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Réponses au questionnaire envoyé après 3 mises en situation, ou à J+7 de l&apos;activation.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-[var(--border)] bg-white p-6 text-sm text-[var(--muted)]">
          Aucune réponse pour le moment.
        </p>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => {
            const answers = [r.q1, r.q2, r.q3];
            return (
              <li key={r.id} className="rounded-xl border border-[var(--border)] bg-white p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold">{r.email}</span>
                  <span className="text-xs text-[var(--muted)]">
                    {r.cohort ? `${r.cohort} · ` : ""}
                    {fmt(r.createdAt)}
                  </span>
                </div>
                <dl className="mt-3 space-y-3">
                  {FEEDBACK_QUESTIONS.map((q, i) => (
                    <div key={i}>
                      <dt className="text-xs font-medium text-[var(--muted)]">
                        {i + 1}. {q}
                      </dt>
                      <dd className="mt-0.5 whitespace-pre-wrap text-sm">
                        {answers[i]?.trim() ? answers[i] : <span className="text-[var(--muted)]">—</span>}
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
