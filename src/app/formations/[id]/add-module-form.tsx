import { addModule } from "../actions";

type Comp = { code: string; nom: string; cat: string };

// Multi-référentiel : on coche des compétences dans un ou plusieurs référentiels.
// Les cases sont nommées `comp:<frameworkId>:<code>` et regroupées côté serveur.
export default function AddModuleForm({
  formationId,
  frameworks,
  compsByFw,
}: {
  formationId: string;
  frameworks: { id: string; nom: string }[];
  compsByFw: Record<string, Comp[]>;
}) {
  if (frameworks.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Aucun domaine disponible. Demandez l&apos;accès à votre administrateur.
      </p>
    );
  }

  return (
    <form
      action={addModule}
      className="space-y-4 rounded-xl border border-dashed border-[var(--border)] bg-white p-4"
    >
      <input type="hidden" name="formationId" value={formationId} />
      <div>
        <label className="text-xs font-medium">Nom du module</label>
        <input
          name="nom"
          required
          placeholder="ex. Module 1 — L'écoute et l'alliance"
          className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm sm:max-w-md"
        />
      </div>

      <div className="space-y-4">
        <p className="text-xs text-[var(--muted)]">
          Cochez les compétences couvertes par ce module — vous pouvez en prendre dans
          <b> plusieurs référentiels</b>.
        </p>
        {frameworks.map((f) => {
          const comps = compsByFw[f.id] ?? [];
          const cats = Array.from(new Set(comps.map((c) => c.cat)));
          return (
            <div key={f.id} className="rounded-lg border border-[var(--border)] p-3">
              <div className="text-sm font-semibold">{f.nom}</div>
              <div className="mt-2 space-y-2">
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
                            <input
                              type="checkbox"
                              name={`comp:${f.id}:${c.code}`}
                            />
                            {c.nom}
                          </label>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <button className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]">
        Ajouter le module
      </button>
    </form>
  );
}
