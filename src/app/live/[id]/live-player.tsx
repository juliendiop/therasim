"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, MessageCircle, Send, XCircle } from "lucide-react";
import type { PublicDrill } from "@/lib/drill-view";

type Feedback = {
  feedback: string;
  is_best: boolean;
  score: number;
  modele_reponse: string;
};
type RecapDetail = {
  stimulus: string;
  your_text: string;
  correct_text: string;
  feedback: string;
  is_best: boolean;
  score: number;
};
type Recap = { score: number | null; details: RecapDetail[] };

export default function LivePlayer({
  sessionId,
  titre,
  mode,
  closesAt,
  prenom,
  questions,
  answeredDrillIds,
}: {
  sessionId: string;
  titre: string;
  mode: "apprentissage" | "evaluation";
  closesAt: string | null;
  prenom: string;
  questions: PublicDrill[];
  answeredDrillIds: string[];
}) {
  const startIndex = useMemo(() => {
    const i = questions.findIndex((q) => !answeredDrillIds.includes(q.id));
    return i === -1 ? questions.length : i;
  }, [questions, answeredDrillIds]);

  const [index, setIndex] = useState(startIndex);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [recap, setRecap] = useState<Recap | null>(null);
  const [finished, setFinished] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);

  const finish = useCallback(async () => {
    if (finished) return;
    setFinished(true);
    try {
      const res = await fetch(`/api/live/${sessionId}/finish`, { method: "POST" });
      const data = await res.json();
      setRecap(data as Recap);
    } catch {
      setRecap({ score: null, details: [] });
    }
  }, [finished, sessionId]);

  // Compte à rebours.
  useEffect(() => {
    if (!closesAt) return;
    const end = new Date(closesAt).getTime();
    const tick = () => {
      const r = Math.max(0, Math.round((end - Date.now()) / 1000));
      setRemaining(r);
      if (r <= 0) finish();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [closesAt, finish]);

  // Toutes les questions déjà répondues -> clôture directe.
  useEffect(() => {
    if (index >= questions.length && !finished) finish();
  }, [index, questions.length, finished, finish]);

  const q = questions[index];

  function advance() {
    setSelected(null);
    setFeedback(null);
    setIndex((i) => i + 1);
  }

  async function submit() {
    if (selected === null || busy || !q) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/live/${sessionId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drillId: q.id, option_index: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "temps_ecoule") finish();
        return;
      }
      if (mode === "apprentissage") setFeedback(data as Feedback);
      else advance();
    } finally {
      setBusy(false);
    }
  }

  const mmss = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // --- Écran de récap final ---
  if (finished || index >= questions.length) {
    return (
      <div className="mx-auto max-w-2xl">
        <Header titre={titre} remaining={remaining} mmss={mmss} />
        <div className="card-soft mt-4 p-6 text-center">
          <h2 className="text-lg font-semibold">Terminé, {prenom} !</h2>
          {recap?.score != null && (
            <div className="mt-2 text-3xl font-bold text-[var(--accent)]">
              {Math.round(recap.score * 100)}%
            </div>
          )}
          <p className="mt-1 text-sm text-[var(--muted)]">
            Vos réponses ont bien été enregistrées. Le formateur partagera les résultats.
          </p>
        </div>

        {recap && recap.details.length > 0 && (
          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-semibold">Correction</h3>
            {recap.details.map((d, i) => (
              <div key={i} className="card-soft p-4 text-sm">
                <p className="italic text-[var(--muted)]">« {d.stimulus} »</p>
                <p className={`mt-2 ${d.is_best ? "text-green-700" : "text-amber-700"}`}>
                  Votre réponse : {d.your_text}
                </p>
                {!d.is_best && (
                  <p className="mt-1 text-green-700">Meilleure réponse : {d.correct_text}</p>
                )}
                {d.feedback && <p className="mt-1 text-[var(--muted)]">{d.feedback}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- Question en cours ---
  return (
    <div className="mx-auto max-w-2xl">
      <Header titre={titre} remaining={remaining} mmss={mmss} />
      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
        Question {index + 1} / {questions.length}
      </p>

      <div className="mt-2 card-soft p-4">
        <div className="text-xs font-medium text-[var(--accent)]">Mise en situation</div>
        <p className="mt-1 text-sm">{q.rappel_theorique}</p>
        <div className="mt-3 flex gap-2 rounded-lg bg-gray-50 p-3">
          <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
          <p className="text-[15px] italic">« {q.stimulus} »</p>
        </div>
      </div>

      {!feedback ? (
        <div className="mt-4 space-y-2">
          {q.options?.map((o, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition ${
                selected === i
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-[var(--border)] bg-white hover:border-gray-300"
              }`}
            >
              {o.text}
            </button>
          ))}
          <button
            onClick={submit}
            disabled={selected === null || busy}
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> {busy ? "..." : "Valider"}
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div
            className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${
              feedback.is_best
                ? "border-green-200 bg-green-50"
                : "border-amber-200 bg-amber-50"
            }`}
          >
            {feedback.is_best ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            ) : (
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            )}
            <div>
              <p>{feedback.feedback}</p>
              <p className="mt-2 text-[var(--muted)]">
                Réponse modèle : {feedback.modele_reponse}
              </p>
            </div>
          </div>
          <button
            onClick={advance}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
          >
            {index + 1 < questions.length ? "Question suivante" : "Terminer"}
          </button>
        </div>
      )}
    </div>
  );
}

function Header({
  titre,
  remaining,
  mmss,
}: {
  titre: string;
  remaining: number | null;
  mmss: (s: number) => string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h1 className="text-base font-semibold">{titre}</h1>
      {remaining != null && (
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${
            remaining <= 30
              ? "bg-red-50 text-red-600"
              : "bg-[var(--accent-soft)] text-[var(--accent)]"
          }`}
        >
          <Clock className="h-4 w-4" /> {mmss(remaining)}
        </span>
      )}
    </div>
  );
}
