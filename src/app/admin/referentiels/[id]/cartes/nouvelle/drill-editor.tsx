"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { createDrill, generateDraftAction } from "../../../actions";

type Opt = { text: string; is_best: boolean; score: number; feedback: string };

const EMPTY_OPTS: Opt[] = [
  { text: "", is_best: true, score: 1, feedback: "" },
  { text: "", is_best: false, score: 0, feedback: "" },
  { text: "", is_best: false, score: 0, feedback: "" },
];

export default function DrillEditor({
  frameworkId,
  competencies,
  defaultCompetency,
  aiAvailable,
}: {
  frameworkId: string;
  competencies: { code: string; nom: string }[];
  defaultCompetency: string;
  aiAvailable: boolean;
}) {
  const [competency, setCompetency] = useState(defaultCompetency);
  const [mode, setMode] = useState<"reconnaissance" | "production">("reconnaissance");
  const [difficulty, setDifficulty] = useState(1);
  const [rappel, setRappel] = useState("");
  const [stimulus, setStimulus] = useState("");
  const [modele, setModele] = useState("");
  const [reaction, setReaction] = useState("");
  const [options, setOptions] = useState<Opt[]>(EMPTY_OPTS);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  function setOpt(i: number, patch: Partial<Opt>) {
    setOptions((prev) => prev.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  }
  function setBest(i: number) {
    setOptions((prev) =>
      prev.map((o, j) => ({ ...o, is_best: j === i, score: j === i ? 1 : o.score })),
    );
  }

  async function generate() {
    setGenerating(true);
    setGenError(null);
    const r = await generateDraftAction({
      frameworkId,
      competencyCode: competency,
      mode,
      difficulty,
    });
    setGenerating(false);
    if (!r.ok) {
      setGenError(r.error);
      return;
    }
    const d = r.draft;
    setRappel(d.rappel_theorique);
    setStimulus(d.stimulus);
    setModele(d.modele_reponse);
    setReaction(d.patient_reaction_si_bon ?? "");
    if (mode === "reconnaissance" && d.options && d.options.length > 0) {
      setOptions(
        d.options.slice(0, 4).map((o) => ({
          text: o.text ?? "",
          is_best: Boolean(o.is_best),
          score: typeof o.score === "number" ? o.score : o.is_best ? 1 : 0,
          feedback: o.feedback ?? "",
        })),
      );
    }
  }

  const inputCls =
    "mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm outline-none focus:border-[var(--accent)]";

  return (
    <form action={createDrill} className="mt-4 space-y-4">
      <input type="hidden" name="frameworkId" value={frameworkId} />
      <input
        type="hidden"
        name="optionsJson"
        value={JSON.stringify(mode === "reconnaissance" ? options : [])}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <label className="text-xs font-medium">Compétence</label>
          <select
            name="competencyId"
            value={competency}
            onChange={(e) => setCompetency(e.target.value)}
            className={inputCls}
          >
            {competencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.nom}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium">Mode</label>
          <select
            name="mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as "reconnaissance" | "production")}
            className={inputCls}
          >
            <option value="reconnaissance">Reconnaissance (QCM)</option>
            <option value="production">Production (réponse libre)</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium">Difficulté</label>
          <select
            name="difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(Number(e.target.value))}
            className={inputCls}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </div>
      </div>

      {/* Génération IA */}
      <div className="rounded-lg border border-dashed border-[var(--accent-border)] bg-[var(--accent-soft)] p-3">
        <button
          type="button"
          onClick={generate}
          disabled={generating || !aiAvailable}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {generating ? "Génération…" : "Générer un brouillon par IA"}
        </button>
        <span className="ml-2 text-xs text-[var(--muted)]">
          {aiAvailable
            ? "Pré-remplit les champs ci-dessous (à relire/corriger)."
            : "Indisponible : configurez une clé API IA (Mistral ou Anthropic)."}
        </span>
        {genError && <p className="mt-2 text-xs text-red-600">{genError}</p>}
      </div>

      <div>
        <label className="text-xs font-medium">Rappel théorique</label>
        <textarea name="rappelTheorique" value={rappel} onChange={(e) => setRappel(e.target.value)} rows={2} className={inputCls} required />
      </div>
      <div>
        <label className="text-xs font-medium">Stimulus (réplique du patient)</label>
        <textarea name="stimulus" value={stimulus} onChange={(e) => setStimulus(e.target.value)} rows={2} className={inputCls} required />
      </div>
      <div>
        <label className="text-xs font-medium">Réponse modèle</label>
        <textarea name="modeleReponse" value={modele} onChange={(e) => setModele(e.target.value)} rows={2} className={inputCls} required />
      </div>
      <div>
        <label className="text-xs font-medium">Réaction du patient si bonne réponse (optionnel)</label>
        <input name="patientReactionSiBon" value={reaction} onChange={(e) => setReaction(e.target.value)} className={inputCls} />
      </div>

      {/* Options (reconnaissance) */}
      {mode === "reconnaissance" && (
        <div>
          <label className="text-xs font-medium">Options du QCM (cochez la meilleure)</label>
          <div className="mt-2 space-y-2">
            {options.map((o, i) => (
              <div key={i} className="rounded-lg border border-[var(--border)] p-2">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="best"
                    checked={o.is_best}
                    onChange={() => setBest(i)}
                    title="Meilleure réponse"
                  />
                  <input
                    value={o.text}
                    onChange={(e) => setOpt(i, { text: e.target.value })}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1 rounded border border-[var(--border)] p-1.5 text-sm"
                  />
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={o.score}
                    onChange={(e) => setOpt(i, { score: Number(e.target.value) })}
                    className="w-16 rounded border border-[var(--border)] p-1.5 text-sm"
                    title="Score 0..1"
                  />
                </div>
                <input
                  value={o.feedback}
                  onChange={(e) => setOpt(i, { feedback: e.target.value })}
                  placeholder="Feedback de cette option"
                  className="mt-1 w-full rounded border border-[var(--border)] p-1.5 text-xs"
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setOptions((p) => [...p, { text: "", is_best: false, score: 0, feedback: "" }])}
              className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs hover:border-[var(--accent)]"
            >
              + Option
            </button>
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => setOptions((p) => p.slice(0, -1))}
                className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs hover:border-red-400"
              >
                − Retirer la dernière
              </button>
            )}
          </div>
        </div>
      )}

      <button className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]">
        Créer la carte
      </button>
    </form>
  );
}
