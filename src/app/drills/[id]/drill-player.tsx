"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  Dumbbell,
  Lightbulb,
  MessageCircle,
  RotateCcw,
  Send,
  XCircle,
} from "lucide-react";
import type { PublicDrill } from "@/lib/drill-view";

type Feedback = {
  mode: string;
  is_best?: boolean;
  non_evalue?: boolean;
  note?: number;
  score?: number;
  feedback: string;
  evidence?: string;
  suggested_better_response?: string;
  modele_reponse: string;
  patient_reaction?: string | null;
};

export default function DrillPlayer({ drill }: { drill: PublicDrill }) {
  const router = useRouter();
  const [selected, setSelected] = useState<number | null>(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isReco = drill.mode === "reconnaissance";

  async function submit(payload: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/drills/${drill.id}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? data.error ?? "Une erreur est survenue.");
        return;
      }
      setFeedback(data as Feedback);
    } catch {
      setError("Connexion impossible. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setSelected(null);
    setAnswer("");
    setFeedback(null);
    setError(null);
  }

  const good = feedback && (feedback.is_best || (feedback.score ?? 0) >= 0.75);

  return (
    <div className="mx-auto max-w-2xl">
      <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
        {isReco ? "Reconnaissance" : "Production"} · difficulté {drill.difficulty}
      </span>

      {/* Rappel théorique */}
      <div className="mt-3 flex gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
        <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]" />
        <div>
          <div className="text-sm font-semibold text-[var(--accent)]">Rappel</div>
          <p className="mt-0.5 text-sm">{drill.rappel_theorique}</p>
        </div>
      </div>

      {/* Stimulus (réplique du patient) */}
      <div className="mt-4 flex gap-3 rounded-xl border border-[var(--border)] bg-white p-4">
        <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
            Le patient
          </div>
          <p className="mt-0.5 text-[15px] italic">« {drill.stimulus} »</p>
        </div>
      </div>

      {/* Zone de réponse */}
      {!feedback && (
        <div className="mt-5">
          {isReco ? (
            <div className="space-y-2">
              {drill.options?.map((o, i) => (
                <button
                  key={i}
                  onClick={() => setSelected(i)}
                  className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition ${
                    selected === i
                      ? "border-[var(--accent)] bg-indigo-50"
                      : "border-[var(--border)] bg-white hover:border-gray-300"
                  }`}
                >
                  {o.text}
                </button>
              ))}
              <button
                disabled={selected === null || loading}
                onClick={() => submit({ option_index: selected })}
                className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" /> {loading ? "..." : "Valider"}
              </button>
            </div>
          ) : (
            <div>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={4}
                placeholder="Votre réponse au patient…"
                className="w-full rounded-lg border border-[var(--border)] bg-white p-3 text-sm outline-none focus:border-[var(--accent)]"
              />
              <button
                disabled={!answer.trim() || loading}
                onClick={() => submit({ answer })}
                className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" /> {loading ? "Évaluation…" : "Envoyer"}
              </button>
            </div>
          )}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>
      )}

      {/* Feedback */}
      {feedback && (
        <div className="mt-5 space-y-4">
          {!feedback.non_evalue && (
            <div
              className={`flex items-start gap-3 rounded-xl border p-4 ${
                good ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"
              }`}
            >
              {good ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              )}
              <div className="text-sm">
                <p>{feedback.feedback}</p>
                {feedback.evidence && (
                  <p className="mt-2 text-[var(--muted)]">
                    Votre réponse : « {feedback.evidence} »
                  </p>
                )}
                {feedback.suggested_better_response && (
                  <p className="mt-2">
                    <span className="font-medium">Mieux : </span>
                    {feedback.suggested_better_response}
                  </p>
                )}
              </div>
            </div>
          )}

          {feedback.non_evalue && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
              {feedback.feedback || "Réponse non évaluable pour cette compétence."}
            </div>
          )}

          {/* Réaction du patient à une bonne réponse */}
          {feedback.patient_reaction && (
            <div className="flex gap-3 rounded-xl border border-[var(--border)] bg-white p-4">
              <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
              <p className="text-sm italic">« {feedback.patient_reaction} »</p>
            </div>
          )}

          {/* Modèle de réponse */}
          <div className="flex gap-3 rounded-xl border border-[var(--border)] bg-white p-4">
            <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div className="text-sm">
              <div className="font-medium">Réponse modèle</div>
              <p className="mt-0.5 text-[var(--muted)]">{feedback.modele_reponse}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={reset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium hover:border-gray-300"
            >
              <RotateCcw className="h-4 w-4" /> Rejouer
            </button>
            <button
              onClick={() => router.push(`/f/${drill.framework_id}/entrainement`)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Dumbbell className="h-4 w-4" /> Drill suivant
            </button>
            <button
              onClick={() => router.push(`/f/${drill.framework_id}`)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium hover:border-gray-300"
            >
              Voir ma carte
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
