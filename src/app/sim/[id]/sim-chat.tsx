"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Flag, Lightbulb, Send, Target, User2 } from "lucide-react";
import type { Debrief } from "@/lib/simulator";

type Msg = { role: string; content: string };

export default function SimChat({
  sessionId,
  frameworkId,
  titre,
  contexte,
  statut,
  kind,
  maxTurns,
  focusNoms,
  initialMessages,
  initialDebrief,
}: {
  sessionId: string;
  frameworkId: string;
  titre: string;
  contexte: string;
  statut: string;
  kind: string;
  maxTurns: number | null;
  focusNoms: string[];
  initialMessages: Msg[];
  initialDebrief: Debrief | null;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debrief, setDebrief] = useState<Debrief | null>(initialDebrief);
  const [ended, setEnded] = useState(statut === "terminee");
  const [hint, setHint] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isMini = kind === "miniscene";
  const turns = messages.filter((m) => m.role === "apprenant").length;
  const capReached = maxTurns != null && turns >= maxTurns;

  async function askHint() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sim/${sessionId}/hint`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) setError(data.message ?? data.error ?? "Erreur");
      else setHint(data.hint);
    } catch {
      setError("Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }

  function scrollDown() {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  }

  async function send() {
    const content = input.trim();
    if (!content || busy || ended || capReached) return;
    setInput("");
    setError(null);
    setMessages((m) => [...m, { role: "apprenant", content }]);
    scrollDown();
    setBusy(true);
    try {
      const res = await fetch(`/api/sim/${sessionId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? data.error ?? "Erreur");
        return;
      }
      setMessages((m) => [...m, { role: "patient", content: data.reply }]);
      scrollDown();
    } catch {
      setError("Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function terminer() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sim/${sessionId}/end`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? data.error ?? "Erreur");
        return;
      }
      setDebrief(data.debrief as Debrief);
      setEnded(true);
      scrollDown();
    } catch {
      setError("Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{titre}</h1>
          {contexte && <p className="mt-0.5 text-xs text-[var(--muted)]">{contexte}</p>}
        </div>
        {!ended && (
          <button
            onClick={terminer}
            disabled={busy || turns === 0}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium hover:border-red-400 hover:text-red-600 disabled:opacity-50"
          >
            <Flag className="h-4 w-4" /> Terminer
          </button>
        )}
      </div>

      {/* Bannière objectif (mini-scène N2) */}
      {isMini && focusNoms.length > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-sm">
          <Target className="h-4 w-4 shrink-0 text-[var(--accent)]" />
          <span>
            <b>Mini-scène guidée</b> — on travaille : {focusNoms.join(" + ")}
            {maxTurns ? ` · ${maxTurns} tours` : ""}
          </span>
        </div>
      )}

      {/* Conversation */}
      <div className="mt-4 space-y-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "apprenant" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                m.role === "apprenant"
                  ? "bg-[var(--accent)] text-white"
                  : "border border-[var(--border)] bg-white"
              }`}
            >
              {m.role === "patient" && (
                <div className="mb-0.5 flex items-center gap-1 text-[11px] font-medium text-[var(--muted)]">
                  <User2 className="h-3 w-3" /> Patient
                </div>
              )}
              {m.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Indice (mini-scène N2) */}
      {hint && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <span>{hint}</span>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {/* Fin de mini-scène atteinte */}
      {!ended && capReached && (
        <p className="mt-4 rounded-lg border border-[var(--border)] bg-gray-50 p-3 text-center text-sm text-[var(--muted)]">
          Fin de la mise en situation. Cliquez sur <b>Terminer</b> pour recevoir votre débrief.
        </p>
      )}

      {/* Saisie */}
      {!ended && !capReached && (
        <div className="mt-4 flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={2}
            placeholder="Votre réponse au patient… (Entrée pour envoyer)"
            className="flex-1 rounded-lg border border-[var(--border)] p-2.5 text-sm outline-none focus:border-[var(--accent)]"
          />
          <div className="flex flex-col gap-1.5">
            <button
              onClick={send}
              disabled={busy || !input.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4" /> {busy ? "…" : "Envoyer"}
            </button>
            {isMini && (
              <button
                onClick={askHint}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-4 py-1.5 text-xs font-medium text-[var(--muted)] hover:border-amber-400 hover:text-amber-600 disabled:opacity-50"
              >
                <Lightbulb className="h-3.5 w-3.5" /> Indice
              </button>
            )}
          </div>
        </div>
      )}
      {!ended && (
        <p className="mt-2 text-center text-xs text-[var(--muted)]">
          {turns} tour(s)
          {!isMini && turns >= 15 ? " — pensez à clôturer l'entretien." : ""}
        </p>
      )}

      {/* Débrief */}
      {debrief && <DebriefView debrief={debrief} frameworkId={frameworkId} router={router} />}
    </div>
  );
}

function DebriefView({
  debrief,
  frameworkId,
  router,
}: {
  debrief: Debrief;
  frameworkId: string;
  router: ReturnType<typeof useRouter>;
}) {
  const scored = debrief.scores.filter((s) => !s.non_evalue);
  return (
    <div className="mt-8 border-t border-[var(--border)] pt-6">
      <h2 className="text-lg font-semibold">Débrief</h2>

      {debrief.narrative && (
        <p className="mt-2 rounded-xl border border-[var(--border)] bg-white p-4 text-sm">
          {debrief.narrative}
        </p>
      )}

      {scored.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold">Évaluation par compétence</h3>
          <div className="mt-2 space-y-2">
            {scored.map((s) => (
              <div
                key={s.competency_id}
                className="rounded-lg border border-[var(--border)] bg-white p-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{s.competency_id}</span>
                  <span className="font-semibold">{s.note}/5</span>
                </div>
                {s.justification && (
                  <p className="mt-1 text-xs text-[var(--muted)]">{s.justification}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {debrief.moments.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold">Moments clés</h3>
          <div className="mt-2 space-y-2">
            {debrief.moments.map((m, i) => (
              <div key={i} className="rounded-lg bg-gray-50 p-3 text-sm">
                <p className="italic">« {m.quote} »</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{m.comment}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => router.push(`/f/${frameworkId}`)}
        className="mt-6 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        Voir ma carte de progression
      </button>
    </div>
  );
}
