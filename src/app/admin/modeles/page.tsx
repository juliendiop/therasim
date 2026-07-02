import { Cpu } from "lucide-react";
import {
  LLM_USAGES,
  MODELES_SUGGESTS,
  MODELES_SUGGESTS_ANTHROPIC,
  PROVIDERS,
  getAllLlm,
} from "@/lib/config";
import { setModelsAction } from "./actions";

export const dynamic = "force-dynamic";

// Choix du FOURNISSEUR (Mistral ou Claude/Anthropic) + du modèle, par usage.
// Les clés API restent en variables d'environnement (jamais en base).
export default async function ModelesPage() {
  const llm = await getAllLlm();
  const keys: Record<string, boolean> = {
    mistral: Boolean(process.env.MISTRAL_API_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2">
        <Cpu className="h-5 w-5 text-[var(--accent)]" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Fournisseur &amp; modèle IA par usage
        </h2>
      </div>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Pour chaque usage, choisis le fournisseur (Mistral ou Claude) et le modèle. La clé
        API du fournisseur doit être présente en variable d&apos;environnement
        (<code>MISTRAL_API_KEY</code> / <code>ANTHROPIC_API_KEY</code> — sur Vercel :
        Settings → Environment Variables).
      </p>

      {/* Statut des clés */}
      <div className="mt-3 space-y-2">
        {PROVIDERS.map((p) => (
          <div
            key={p.key}
            className={`rounded-lg border p-3 text-sm ${
              keys[p.key]
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-amber-300 bg-amber-50 text-amber-800"
            }`}
          >
            {keys[p.key]
              ? `✓ ${p.label} — clé configurée (${p.envKey}).`
              : `⚠️ ${p.label} — clé absente (${p.envKey}) : ce fournisseur est indisponible.`}
          </div>
        ))}
      </div>

      <form action={setModelsAction} className="mt-5 space-y-4">
        <datalist id="modeles-mistral">
          {MODELES_SUGGESTS.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <datalist id="modeles-anthropic">
          {MODELES_SUGGESTS_ANTHROPIC.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <datalist id="modeles-tous">
          {[...MODELES_SUGGESTS_ANTHROPIC, ...MODELES_SUGGESTS].map((m) => (
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
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <select
                name={`provider.${u.key}`}
                defaultValue={llm[u.key].provider}
                className="rounded-lg border border-[var(--border)] p-2 text-sm sm:w-48"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
              <input
                name={`model.${u.key}`}
                list="modeles-tous"
                defaultValue={llm[u.key].model}
                placeholder="claude-opus-4-8 ou mistral-small-latest"
                className="flex-1 rounded-lg border border-[var(--border)] p-2 text-sm"
              />
            </div>
            <p className="mt-1.5 text-xs text-[var(--muted)]">
              Claude : {MODELES_SUGGESTS_ANTHROPIC.join(" · ")} — Mistral :{" "}
              {MODELES_SUGGESTS.slice(0, 3).join(" · ")}
            </p>
          </div>
        ))}

        <button className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]">
          Enregistrer
        </button>
      </form>

      <p className="mt-4 text-xs text-[var(--muted)]">
        Astuce : si le modèle saisi ne correspond pas au fournisseur choisi (ex. un modèle
        Mistral avec le fournisseur Claude), le modèle par défaut du fournisseur est utilisé.
      </p>
    </div>
  );
}
