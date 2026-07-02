"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Flag, Lightbulb, Send, Target, User2 } from "lucide-react";
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
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debrief, setDebrief] = useState<Debrief | null>(initialDebrief);
  const [ended, setEnded] = useState(statut === "terminee");
  const [hint, setHint] = useState<string | null>(null);
  // Réponse du patient en cours de réception ("" = il « réfléchit » encore).
  const [pending, setPending] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  function autoresize() {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  async function send() {
    const content = input.trim();
    if (!content || busy || ending || ended || capReached) return;
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setError(null);
    setMessages((m) => [...m, { role: "apprenant", content }]);
    setPending(""); // « le patient réfléchit… » jusqu'au premier fragment
    scrollDown();
    setBusy(true);
    try {
      const res = await fetch(`/api/sim/${sessionId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      // Erreur : réponse JSON (le flux normal est en text/plain).
      if (!res.ok || res.headers.get("content-type")?.includes("application/json")) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? data.error ?? "Erreur");
        // On rend sa réplique à l'apprenant pour qu'il puisse réessayer.
        setMessages((m) => m.slice(0, -1));
        setInput(content);
        setPending(null);
        return;
      }

      // Lecture du flux : la réplique du patient s'écrit au fil de l'eau.
      const reader = res.body?.getReader();
      if (!reader) throw new Error("flux indisponible");
      const decoder = new TextDecoder();
      let full = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setPending(full);
        scrollDown();
      }
      const reply = full.trim();
      if (reply) setMessages((m) => [...m, { role: "patient", content: reply }]);
      else setError("Le patient n'a pas répondu. Réessayez.");
      setPending(null);
      scrollDown();
    } catch {
      setError("Connexion impossible.");
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  async function terminer() {
    if (busy || ending) return;
    if (turns === 0) {
      setError("Échangez au moins une fois avec le patient avant de terminer la mise en situation.");
      return;
    }
    setConfirmEnd(false);
    setEnding(true);
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
      setEnding(false);
    }
  }

  // Fin naturelle de mini-scène : plus rien à confirmer. Sinon, 2 temps.
  function onEndClick() {
    if (busy || ending) return;
    if (turns === 0) {
      setError("Échangez au moins une fois avec le patient avant de terminer la mise en situation.");
      return;
    }
    if (capReached) void terminer();
    else setConfirmEnd(true);
  }

  return (
    <div className="mx-auto max-w-2xl">
      {ended && (
        <Link
          href="/historique"
          className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-4 w-4" /> Mon historique
        </Link>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{titre}</h1>
          {contexte && <p className="mt-0.5 text-xs text-[var(--muted)]">{contexte}</p>}
        </div>
        {!ended && (
          <button
            onClick={onEndClick}
            disabled={busy || ending}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium hover:border-red-400 hover:text-red-600 disabled:opacity-50"
          >
            <Flag className="h-4 w-4" /> {ending ? "Analyse…" : "Terminer"}
          </button>
        )}
      </div>

      {/* Bannière objectif (mini-scène N2) avec compteur de tours vivant */}
      {isMini && focusNoms.length > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-2 text-sm">
          <Target className="h-4 w-4 shrink-0 text-[var(--accent)]" />
          <span className="flex-1">
            <b>Mini-scène guidée</b> — on travaille : {focusNoms.join(" + ")}
          </span>
          {maxTurns != null && !ended && (
            <span className="tabular shrink-0 rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-[var(--accent)]">
              {capReached ? "dernier tour joué" : `tour ${Math.min(turns + 1, maxTurns)}/${maxTurns}`}
            </span>
          )}
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

        {/* Réponse du patient en cours : « réfléchit… » puis texte au fil de l'eau */}
        {pending !== null && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl border border-[var(--border)] bg-white px-4 py-2 text-sm">
              <div className="mb-0.5 flex items-center gap-1 text-[11px] font-medium text-[var(--muted)]">
                <User2 className="h-3 w-3" /> Patient
              </div>
              {pending === "" ? (
                <span className="inline-flex items-center gap-1 py-1" aria-label="Le patient réfléchit…">
                  <span className="ts-dot" />
                  <span className="ts-dot" style={{ animationDelay: "0.15s" }} />
                  <span className="ts-dot" style={{ animationDelay: "0.3s" }} />
                </span>
              ) : (
                pending
              )}
            </div>
          </div>
        )}
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

      {/* Confirmation avant de clôturer (le débrief est définitif) */}
      {confirmEnd && !ended && (
        <div className="mt-4 flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-white p-3 text-sm sm:flex-row sm:items-center">
          <span className="flex-1">
            Terminer {isMini ? "la mini-scène" : "l'entretien"} et recevoir le débrief&nbsp;?
            Cette action est définitive.
          </span>
          <div className="flex gap-2">
            <button
              onClick={terminer}
              className="rounded-lg bg-[var(--accent)] px-3 py-1.5 font-medium text-white hover:bg-[var(--accent-hover)]"
            >
              Oui, terminer
            </button>
            <button
              onClick={() => setConfirmEnd(false)}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              Continuer l&apos;échange
            </button>
          </div>
        </div>
      )}

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
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              autoresize();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={2}
            placeholder="Votre réponse au patient… (Entrée pour envoyer, Maj+Entrée : à la ligne)"
            className="flex-1 resize-none rounded-lg border border-[var(--border)] p-2.5 text-sm outline-none focus:border-[var(--accent)]"
          />
          <div className="flex flex-col gap-1.5">
            <button
              onClick={send}
              disabled={busy || ending || !input.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
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
      {!ended && !isMini && (
        <p className="mt-2 text-center text-xs text-[var(--muted)]">
          {turns} tour(s)
          {turns >= 15 ? " — pensez à clôturer l'entretien." : ""}
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
        className="mt-6 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
      >
        Voir ma carte de progression
      </button>
    </div>
  );
}
