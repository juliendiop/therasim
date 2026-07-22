"use client";

// Exercice de démonstration jouable SANS compte sur la page publique.
// Reconnaissance pure (QCM) : tout est embarqué côté client, aucun appel LLM,
// aucun crédit consommé, rien n'est enregistré. Contenu adapté du référentiel EM.

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

type DemoOption = { text: string; is_best: boolean; score: number; feedback: string };
type DemoDrill = {
  competence: string;
  rappel: string;
  stimulus: string;
  options: DemoOption[];
  modele: string;
  reactionSiBon: string;
};

const DEMO_DRILLS: DemoDrill[] = [
  {
    competence: "Reflets",
    rappel:
      "Un reflet renvoie le vécu du patient. Le reflet complexe ajoute du sens ou nomme l'émotion sous-jacente.",
    stimulus: "Le soir, c'est le seul moment où je décompresse vraiment.",
    options: [
      {
        text: "Donc vous buvez tous les soirs.",
        is_best: false,
        score: 0,
        feedback: "Interprétation factuelle et un peu accusatrice — ce n'est pas un reflet.",
      },
      {
        text: "Vous aimez bien boire le soir.",
        is_best: false,
        score: 0.4,
        feedback: "Reflet simple : il paraphrase, sans ajouter de sens.",
      },
      {
        text: "Ce moment, c'est votre façon de relâcher la pression de la journée.",
        is_best: true,
        score: 1,
        feedback: "Reflet complexe : il nomme la fonction et le vécu sous-jacent.",
      },
    ],
    modele: "Ce verre, le soir, c'est devenu votre soupape pour relâcher la pression.",
    reactionSiBon: "Voilà… c'est exactement ça. Sans ce moment-là, je tiens pas la journée.",
  },
  {
    competence: "Questions ouvertes",
    rappel:
      "Une question ouverte invite à développer ; une fermée appelle oui/non ou oriente déjà la réponse.",
    stimulus: "Je suis là parce que mon médecin a insisté, je vois pas le problème.",
    options: [
      {
        text: "Vous ne pensez pas que vous devriez réduire ?",
        is_best: false,
        score: 0,
        feedback: "Question fermée et orientée : elle confronte et fait monter la résistance.",
      },
      {
        text: "Qu'est-ce qui vous amène ici, de votre point de vue ?",
        is_best: true,
        score: 1,
        feedback: "Question ouverte qui respecte son cadre et ouvre l'exploration.",
      },
      {
        text: "Vous buvez depuis combien de temps ?",
        is_best: false,
        score: 0.5,
        feedback:
          "Ouverte mais factuelle et un peu intrusive d'emblée ; elle n'explore pas la motivation.",
      },
    ],
    modele: "Qu'est-ce qui rendrait ce temps utile pour vous, malgré tout ?",
    reactionSiBon:
      "Bah… si je suis honnête, c'est surtout ma femme qui s'inquiète. Moi, je sais pas trop.",
  },
  {
    competence: "Empathie",
    rappel: "L'empathie accueille le vécu sans juger ni minimiser, et le renvoie au patient.",
    stimulus: "J'ai honte de ne pas y arriver, à mon âge.",
    options: [
      {
        text: "Il ne faut pas avoir honte, beaucoup de gens y arrivent.",
        is_best: false,
        score: 0.2,
        feedback: "Rassurer trop vite minimise le vécu et coupe l'exploration.",
      },
      {
        text: "Cette honte est difficile à porter, surtout après tant d'efforts.",
        is_best: true,
        score: 1,
        feedback: "Accueille l'émotion et la légitime, sans juger.",
      },
      {
        text: "Pourquoi auriez-vous honte ?",
        is_best: false,
        score: 0.4,
        feedback: "Question qui rationalise l'émotion plutôt que de l'accueillir.",
      },
    ],
    modele: "Ce sentiment d'échec pèse lourd, et en parler n'est pas facile.",
    reactionSiBon: "Merci… ça fait du bien de pouvoir le dire sans se sentir jugé.",
  },
];

export default function DemoDrill() {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const drill = DEMO_DRILLS[index];
  const answered = selected !== null;
  const option = answered ? drill.options[selected] : null;
  const good = option ? option.score >= 0.75 : false;

  function next() {
    setSelected(null);
    setIndex((i) => (i + 1) % DEMO_DRILLS.length);
  }

  return (
    <div className="card-soft mx-auto max-w-2xl p-6 text-left">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
        <span>
          Compétence : <span className="text-[var(--accent)]">{drill.competence}</span>
        </span>
        <span className="tabular">
          exemple {index + 1}/{DEMO_DRILLS.length}
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

          {/* Réaction du patient si bonne réponse */}
          {good && (
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
              <RotateCcw className="h-4 w-4" /> Essayer un autre exemple
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
