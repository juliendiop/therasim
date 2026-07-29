"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Coins, Flag, Lightbulb, Send, Sparkles, Target, Trophy } from "lucide-react";
import type { Debrief } from "@/lib/simulator";
import { matchMoments } from "@/lib/moment-match";
import { patientDisplayName } from "@/lib/patient";
import PatientAvatar from "@/app/_components/patient-avatar";

type Msg = { role: string; content: string };
type Competency = { code: string; nom: string };

export default function SimChat({
  sessionId,
  frameworkId,
  titre,
  contexte,
  statut,
  kind,
  maxTurns,
  focusNoms,
  competencies,
  initialMessages,
  initialDebrief,
  initialSelfAssessment,
  lowBalance,
}: {
  sessionId: string;
  frameworkId: string;
  titre: string;
  contexte: string;
  statut: string;
  kind: string;
  maxTurns: number | null;
  focusNoms: string[];
  competencies: Competency[];
  initialMessages: Msg[];
  initialDebrief: Debrief | null;
  initialSelfAssessment: Record<string, number> | null;
  // Carte discrète post-débrief (jamais sur « sans compter »). Calculée côté serveur :
  // la séance ayant été débitée au lancement, le solde au chargement de /sim est déjà à jour.
  lowBalance: { show: boolean; canRecharge: boolean };
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
  const [awaitingSelfAssessment, setAwaitingSelfAssessment] = useState(false);
  const [selfAssessment, setSelfAssessment] = useState<Record<string, number>>(
    initialSelfAssessment ?? {},
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isMini = kind === "miniscene";
  const turns = messages.filter((m) => m.role === "apprenant").length;
  const capReached = maxTurns != null && turns >= maxTurns;
  const patientName = patientDisplayName(titre);
  const nomByCode = useMemo(
    () => new Map(competencies.map((c) => [c.code, c.nom])),
    [competencies],
  );

  // Replay annoté : rattache chaque moment clé du débrief au message correspondant.
  const moments = useMemo(
    () => (debrief ? matchMoments(messages, debrief.moments) : null),
    [debrief, messages],
  );

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
    // `inline: "nearest"` : ne défile jamais horizontalement (évitait de
    // décaler tout le chat vers la droite au premier message sur mobile).
    requestAnimationFrame(() =>
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" }),
    );
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

  async function terminer(assessment: Record<string, number>) {
    if (busy || ending) return;
    if (turns === 0) {
      setError("Échangez au moins une fois avec le patient avant de terminer la mise en situation.");
      return;
    }
    setConfirmEnd(false);
    setAwaitingSelfAssessment(false);
    setEnding(true);
    setError(null);
    try {
      const res = await fetch(`/api/sim/${sessionId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selfAssessment: assessment }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? data.error ?? "Erreur");
        return;
      }
      setDebrief(data.debrief as Debrief);
      setSelfAssessment(assessment);
      setEnded(true);
      scrollDown();
    } catch {
      setError("Connexion impossible.");
    } finally {
      setEnding(false);
    }
  }

  // Fin naturelle de mini-scène : on passe directement à l'auto-évaluation.
  // Sinon, confirmation d'abord (le débrief est définitif).
  function onEndClick() {
    if (busy || ending) return;
    if (turns === 0) {
      setError("Échangez au moins une fois avec le patient avant de terminer la mise en situation.");
      return;
    }
    if (capReached || competencies.length === 0) setAwaitingSelfAssessment(true);
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
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <PatientAvatar name={patientName} seed={titre} size="lg" />
          <div>
            <h1 className="text-lg font-semibold">{titre}</h1>
            {contexte && <p className="mt-0.5 text-xs text-[var(--muted)]">{contexte}</p>}
          </div>
        </div>
        {!ended && !awaitingSelfAssessment && (
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
          <div key={i}>
            <div
              className={`flex items-end gap-2 ${m.role === "apprenant" ? "justify-end" : "justify-start"}`}
            >
              {m.role === "patient" && (
                <PatientAvatar name={patientName} seed={titre} size="sm" />
              )}
              <div
                className={`max-w-[80%] break-words rounded-2xl px-4 py-2 text-sm ${
                  m.role === "apprenant"
                    ? "bg-[var(--accent)] text-white"
                    : "border border-[var(--border)] bg-white"
                } ${moments?.byIndex.has(i) ? "ring-2 ring-[var(--ochre)] ring-offset-1" : ""}`}
              >
                {m.role === "patient" && (
                  <div className="mb-0.5 text-[11px] font-medium text-[var(--muted)]">
                    {patientName}
                  </div>
                )}
                {m.content}
              </div>
            </div>
            {/* Replay annoté : le(s) moment(s) clé(s) du débrief, en contexte. */}
            {moments?.byIndex.get(i)?.map((moment, j) => (
              <div
                key={j}
                className={`mt-1 flex ${m.role === "apprenant" ? "justify-end" : "justify-start ml-10"}`}
              >
                <div className="flex max-w-[80%] items-start gap-1.5 rounded-lg border border-[var(--ochre-soft)] bg-[var(--ochre-soft)] px-3 py-1.5 text-xs text-[var(--ink-soft)]">
                  <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-[var(--ochre)]" />
                  {moment.comment}
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* Réponse du patient en cours : « réfléchit… » puis texte au fil de l'eau */}
        {pending !== null && (
          <div className="flex items-end justify-start gap-2">
            <PatientAvatar name={patientName} seed={titre} size="sm" />
            <div className="max-w-[80%] break-words rounded-2xl border border-[var(--border)] bg-white px-4 py-2 text-sm">
              <div className="mb-0.5 text-[11px] font-medium text-[var(--muted)]">
                {patientName}
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
      {confirmEnd && !ended && !awaitingSelfAssessment && (
        <div className="mt-4 flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-white p-3 text-sm sm:flex-row sm:items-center">
          <span className="flex-1">
            Terminer {isMini ? "la mini-scène" : "la séance"} et recevoir le débrief&nbsp;?
            Cette action est définitive.
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setConfirmEnd(false);
                setAwaitingSelfAssessment(true);
              }}
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

      {/* Auto-évaluation AVANT de voir la note IA */}
      {awaitingSelfAssessment && !ended && (
        <SelfAssessmentForm
          competencies={competencies}
          value={selfAssessment}
          onChange={setSelfAssessment}
          onSubmit={() => terminer(selfAssessment)}
          onSkip={() => terminer({})}
          busy={ending}
        />
      )}

      {/* Fin de mini-scène atteinte */}
      {!ended && !awaitingSelfAssessment && capReached && (
        <p className="mt-4 rounded-lg border border-[var(--border)] bg-gray-50 p-3 text-center text-sm text-[var(--muted)]">
          Fin de la mise en situation. Cliquez sur <b>Terminer</b> pour recevoir votre débrief.
        </p>
      )}

      {/* Saisie */}
      {!ended && !awaitingSelfAssessment && !capReached && (
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
            className="min-w-0 flex-1 resize-none rounded-lg border border-[var(--border)] p-2.5 text-sm outline-none focus:border-[var(--accent)]"
          />
          <div className="flex shrink-0 flex-col gap-1.5">
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
      {!ended && !awaitingSelfAssessment && !isMini && (
        <p className="mt-2 text-center text-xs text-[var(--muted)]">
          {turns} tour(s)
          {turns >= 15 ? " — pensez à clôturer la séance." : ""}
        </p>
      )}

      {/* Débrief */}
      {debrief && (
        <DebriefView
          debrief={debrief}
          frameworkId={frameworkId}
          router={router}
          nomByCode={nomByCode}
          selfAssessment={selfAssessment}
          unmatchedMoments={moments?.unmatched ?? debrief.moments}
          lowBalance={lowBalance}
        />
      )}
    </div>
  );
}

function SelfAssessmentForm({
  competencies,
  value,
  onChange,
  onSubmit,
  onSkip,
  busy,
}: {
  competencies: Competency[];
  value: Record<string, number>;
  onChange: (v: Record<string, number>) => void;
  onSubmit: () => void;
  onSkip: () => void;
  busy: boolean;
}) {
  return (
    <div className="mt-4 animate-in rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-4">
      <h2 className="text-sm font-semibold text-[var(--accent)]">
        Avant de voir votre débrief…
      </h2>
      <p className="mt-0.5 text-sm text-[var(--ink-soft)]">
        Comment estimez-vous avoir mobilisé chaque compétence, sur cette séance&nbsp;?
      </p>
      <div className="mt-3 space-y-2.5">
        {competencies.map((c) => (
          <div
            key={c.code}
            className="flex flex-col gap-1.5 rounded-lg bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="text-sm font-medium">{c.nom}</span>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onChange({ ...value, [c.code]: n })}
                  aria-label={`${n}/5`}
                  className={`h-8 w-8 rounded-full text-xs font-semibold transition ${
                    value[c.code] === n
                      ? "bg-[var(--accent)] text-white"
                      : "border border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          onClick={onSubmit}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {busy ? "Analyse…" : "Voir mon débrief"}
        </button>
        <button
          onClick={onSkip}
          disabled={busy}
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-50"
        >
          Passer cette étape
        </button>
      </div>
    </div>
  );
}

function DebriefView({
  debrief,
  frameworkId,
  router,
  nomByCode,
  selfAssessment,
  unmatchedMoments,
  lowBalance,
}: {
  debrief: Debrief;
  frameworkId: string;
  router: ReturnType<typeof useRouter>;
  nomByCode: Map<string, string>;
  selfAssessment: Record<string, number>;
  unmatchedMoments: { quote: string; comment: string }[];
  lowBalance: { show: boolean; canRecharge: boolean };
}) {
  const scored = debrief.scores.filter((s) => !s.non_evalue);
  const hasSelfAssessment = Object.keys(selfAssessment).length > 0;
  return (
    <div className="mt-8 border-t border-[var(--border)] pt-6">
      <h2 className="text-lg font-semibold">Débrief</h2>

      {/* Célébration : palier(s) franchi(s) sur cette séance */}
      {debrief.level_ups && debrief.level_ups.length > 0 && (
        <div className="mt-3 space-y-2">
          {debrief.level_ups.map((lu) => (
            <div
              key={lu.competency_id}
              className="ts-level-up flex items-center gap-2.5 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-3 text-sm"
            >
              <Trophy className="h-5 w-5 shrink-0 text-[var(--accent)]" />
              <span>
                <b>{lu.nom}</b> — palier <b>{lu.palier}</b> atteint !
              </span>
            </div>
          ))}
        </div>
      )}

      {debrief.narrative && (
        <p className="mt-2 rounded-xl border border-[var(--border)] bg-white p-4 text-sm">
          {debrief.narrative}
        </p>
      )}

      {scored.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold">Évaluation par compétence</h3>
          <div className="mt-2 space-y-2">
            {scored.map((s) => {
              const self = selfAssessment[s.competency_id];
              return (
                <div
                  key={s.competency_id}
                  className="rounded-lg border border-[var(--border)] bg-white p-3 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {nomByCode.get(s.competency_id) ?? s.competency_id}
                    </span>
                    <span className="flex items-center gap-2">
                      {hasSelfAssessment && (
                        <span className="text-xs text-[var(--muted)]">
                          vous : {self ? `${self}/5` : "—"} ·
                        </span>
                      )}
                      <span className="font-semibold">{s.note}/5</span>
                    </span>
                  </div>
                  {s.justification && (
                    <p className="mt-1 text-xs text-[var(--muted)]">{s.justification}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {unmatchedMoments.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold">Autres moments clés</h3>
          <div className="mt-2 space-y-2">
            {unmatchedMoments.map((m, i) => (
              <div key={i} className="rounded-lg bg-gray-50 p-3 text-sm">
                <p className="italic">« {m.quote} »</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{m.comment}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Carte discrète bas-solde — après le contenu du débrief, avant le CTA de retour. */}
      {lowBalance.show && (
        <div className="mt-6 flex flex-col items-start gap-2 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-4 text-sm sm:flex-row sm:items-center">
          <Coins className="h-5 w-5 shrink-0 text-[var(--accent)]" />
          <p className="flex-1 text-[var(--ink-soft)]">
            {lowBalance.canRecharge
              ? "Votre solde devient bas. Rechargez pour enchaîner d'autres mises en situation."
              : "Votre solde devient bas. Un abonnement débloque bien plus de mises en situation."}
          </p>
          <Link
            href={lowBalance.canRecharge ? "/credits" : "/tarifs"}
            className="shrink-0 rounded-lg border border-[var(--accent)] px-4 py-2 font-semibold text-[var(--accent)] hover:bg-white"
          >
            {lowBalance.canRecharge ? "Recharger" : "Voir les forfaits"}
          </Link>
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
