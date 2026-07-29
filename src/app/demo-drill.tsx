"use client";

// Exercice de démonstration jouable SANS compte sur la page publique.
// Reconnaissance pure (QCM) : aucun appel LLM, aucun crédit consommé, rien n'est
// enregistré. Le CONTENU vient de la base (voir src/lib/landing-copy.ts) et est
// passé en props par la page d'accueil — trois domaines distincts, jamais codés ici.

import { useState } from "react";
import { trackEvent } from "./_components/track";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  MessageCircle,
  RotateCcw,
  Sparkles,
  XCircle,
} from "lucide-react";
import type { DemoDrillView } from "@/lib/landing-copy";

export default function DemoDrill({ drills }: { drills: DemoDrillView[] }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  // La page masque déjà la section si la liste est vide ; garde-fou de rendu.
  const drill = drills[index];
  if (!drill) return null;

  const answered = selected !== null;
  const option = answered ? drill.options[selected] : null;
  const good = option ? option.score >= 0.75 : false;

  function next() {
    setSelected(null);
    setIndex((i) => (i + 1) % drills.length);
  }

  return (
    <div className="card-soft mx-auto max-w-2xl p-6 text-left">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
        <span>
          <span className="text-[var(--ochre)]">{drill.domaine}</span>
          {" · "}
          Compétence : <span className="text-[var(--accent)]">{drill.competence}</span>
        </span>
        <span className="tabular">
          exemple {index + 1}/{drills.length}
        </span>
      </div>

      {/* Rappel théorique */}
      <div className="mt-3 flex gap-3 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-4">
        <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]" />
        <div>
          <div className="text-sm font-semibold text-[var(--accent)]">Rappel</div>
          <p className="mt-0.5 text-sm">{drill.rappel}</p>
        </div>
      </div>

      {/* Réplique du patient */}
      <div className="mt-4 flex gap-3 rounded-xl border border-[var(--border)] bg-white p-4">
        <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
            Le patient
          </div>
          <p className="mt-0.5 text-[15px] italic">« {drill.stimulus} »</p>
        </div>
      </div>

      {/* Options */}
      {!answered ? (
        <div className="mt-5 space-y-2">
          <p className="text-sm font-medium">Que répondez-vous ?</p>
          {drill.options.map((o, i) => (
            <button
              key={i}
              onClick={() => {
                // Mesure d'entonnoir : 1er engagement avec la démo (dédupliqué).
                trackEvent("demo_start", "/");
                setSelected(i);
              }}
              className="w-full rounded-lg border border-[var(--border)] bg-white px-4 py-3 text-left text-sm transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
            >
              {o.text}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-5 animate-in">
          {/* Feedback immédiat */}
          <div
            className={`flex gap-3 rounded-xl border p-4 ${
              good ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"
            }`}
          >
            {good ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            ) : (
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            )}
            <div>
              <div className="text-sm font-semibold">
                {good ? "Bien vu !" : "Pas tout à fait."}
              </div>
              <p className="mt-0.5 text-sm">{option!.feedback}</p>
            </div>
          </div>

          {/* Réponse modèle */}
          <div className="mt-3 rounded-xl border border-[var(--border)] bg-white p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              Réponse modèle
            </div>
            <p className="mt-0.5 text-sm italic">« {drill.modele} »</p>
          </div>

          {/* Réaction du patient si bonne réponse (absente sur certains exercices) */}
          {good && drill.reactionSiBon && (
            <div className="mt-3 flex gap-3 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-4">
              <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]" />
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
                  Le patient réagit
                </div>
                <p className="mt-0.5 text-sm italic">« {drill.reactionSiBon} »</p>
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              onClick={next}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--accent)] transition hover:bg-[var(--accent-soft)]"
            >
              <RotateCcw className="h-4 w-4" /> Essayer un autre domaine
            </button>
            <Link
              href="/inscription"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
            >
              <Sparkles className="h-4 w-4" /> Créer mon compte gratuit
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="mt-2 text-center text-xs text-[var(--muted)]">
            Avec un compte : suivi de progression, exercices adaptés à votre niveau, mises en
            situation avec patient simulé.
          </p>
        </div>
      )}
    </div>
  );
}
