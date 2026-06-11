"use client";

import { useState } from "react";
import { createSessionAction } from "./actions";

type Comp = { code: string; nom: string; cat: string };

export default function CreateSessionForm({
  frameworks,
  compsByFw,
}: {
  frameworks: { id: string; nom: string }[];
  compsByFw: Record<string, Comp[]>;
}) {
  const [fw, setFw] = useState(frameworks[0]?.id ?? "");
  const comps = compsByFw[fw] ?? [];
  const cats = Array.from(new Set(comps.map((c) => c.cat)));

  if (frameworks.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Aucun référentiel disponible. Demandez l&apos;accès à un pack.
      </p>
    );
  }

  return (
    <form
      action={createSessionAction}
      className="space-y-4 rounded-xl border border-[var(--border)] bg-white p-5"
    >
      <div>
        <label className="text-xs font-medium">Titre de la session</label>
        <input
          name="titre"
          placeholder="ex. Évaluation Entretien motivationnel — promo 2026"
          className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="text-xs font-medium">Formation (référentiel)</label>
          <select
            name="frameworkId"
            value={fw}
            onChange={(e) => setFw(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
          >
            {frameworks.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nom}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium">Mode</label>
          <select
            name="mode"
            defaultValue="evaluation"
            className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
          >
            <option value="evaluation">Évaluation (feedback à la fin)</option>
            <option value="apprentissage">Apprentissage (feedback par question)</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium">Durée (minutes)</label>
          <input
            type="number"
            name="durationMin"
            defaultValue={15}
            min={1}
            max={180}
            className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium">Compétences testées</label>
        <div className="mt-2 space-y-3">
          {cats.map((cat) => (
            <div key={cat}>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                {cat}
              </div>
              <div className="mt-1 flex flex-wrap gap-2">
                {comps
                  .filter((c) => c.cat === cat)
                  .map((c) => (
                    <label
                      key={c.code}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:border-[var(--accent)]"
                    >
                      <input type="checkbox" name="competency" value={c.code} defaultChecked />
                      {c.nom}
                    </label>
                  ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">
          L&apos;étude de cas enchaînera des questions testant ces compétences.
        </p>
      </div>

      <button className="rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]">
        Créer la session
      </button>
    </form>
  );
}
