import { Cpu } from "lucide-react";
import { LLM_USAGES, MODELES_SUGGESTS, getAllModels } from "@/lib/config";
import { setModelsAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ModelesPage() {
  const models = await getAllModels();
  const keyConfigured = Boolean(process.env.MISTRAL_API_KEY);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2">
        <Cpu className="h-5 w-5 text-[var(--accent)]" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Modèles IA par usage
        </h2>
      </div>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Choisis le modèle Mistral utilisé pour chaque usage. Vide = modèle par défaut
        (<code>MISTRAL_MODEL</code> dans <code>.env</code>).
      </p>

      <div
        className={`mt-3 rounded-lg border p-3 text-sm ${
          keyConfigured
            ? "border-green-200 bg-green-50 text-green-800"
            : "border-amber-300 bg-amber-50 text-amber-800"
        }`}
      >
        {keyConfigured
          ? "✓ Clé Mistral configurée — les fonctions IA sont actives."
          : "⚠️ Aucune clé Mistral (MISTRAL_API_KEY) : les fonctions IA sont indisponibles."}
      </div>

      <form action={setModelsAction} className="mt-5 space-y-4">
        <datalist id="modeles">
          {MODELES_SUGGESTS.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>

        {LLM_USAGES.map((u) => (
          <div
            key={u.key}
            className="rounded-xl border border-[var(--border)] bg-white p-4"
          >
            <label className="text-sm font-medium">{u.label}</label>
            <p className="text-xs text-[var(--muted)]">{u.desc}</p>
            <input
              name={`model.${u.key}`}
              list="modeles"
              defaultValue={models[u.key]}
              placeholder="mistral-small-latest"
              className="mt-2 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
            />
          </div>
        ))}

        <button className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]">
          Enregistrer
        </button>
      </form>
    </div>
  );
}
