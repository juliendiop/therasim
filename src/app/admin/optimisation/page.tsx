import { Lightbulb, Info, Wand2 } from "lucide-react";
import { getLastAnalysis, isLlmConfigured, type Reco } from "@/lib/growth-advisor";
import { fmtDateTime } from "@/lib/ui";
import CopyPrompt from "./copy-prompt";
import RunButton from "./run-button";

export const dynamic = "force-dynamic";

const IMPACT_STYLE: Record<Reco["impact"], string> = {
  fort: "bg-green-50 text-green-700",
  moyen: "bg-amber-50 text-amber-700",
  faible: "bg-gray-100 text-gray-600",
};
const EFFORT_STYLE: Record<Reco["effort"], string> = {
  faible: "bg-green-50 text-green-700",
  moyen: "bg-amber-50 text-amber-700",
  élevé: "bg-red-50 text-red-700",
};

export default async function AdminOptimisationPage() {
  const [analysis, llmReady] = await Promise.all([
    getLastAnalysis(),
    Promise.resolve(isLlmConfigured()),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Wand2 className="h-5 w-5 text-[var(--accent)]" />
          <h2 className="text-lg font-semibold">Optimisation de la conversion</h2>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          L&apos;IA lit vos mesures d&apos;entonnoir (onglet Acquisition) et propose des pistes
          concrètes pour améliorer la conversion. Chaque piste vient avec un prompt prêt à
          copier-coller dans l&apos;assistant IA de votre choix pour lancer le développement —
          vous gardez le contrôle de ce qui est réellement mis en œuvre.
        </p>
      </div>

      {!llmReady ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Aucun fournisseur IA n&apos;est configuré. Renseignez une clé (Mistral ou Claude)
            dans <b>Modèles IA</b> pour activer l&apos;analyse.
          </span>
        </div>
      ) : (
        <RunButton hasPrevious={Boolean(analysis)} />
      )}

      {analysis && (
        <div className="space-y-5">
          <div className="rounded-xl border border-[var(--border)] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs uppercase tracking-wide text-[var(--muted)]">
                Synthèse du diagnostic
              </div>
              <div className="text-xs text-[var(--muted)]">
                Analyse du {fmtDateTime(analysis.generatedAt)} · {analysis.totalVisits} visites
                sur {analysis.periodDays} j
              </div>
            </div>
            <p className="mt-2 text-sm">{analysis.synthese}</p>
            {analysis.lowVolume && (
              <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Volume faible : ces pistes reposent surtout sur le bon sens UX, pas sur des
                conclusions statistiques. Elles restent utiles pour préparer le terrain avant
                d&apos;avoir plus de trafic.
              </p>
            )}
          </div>

          {analysis.recommandations.map((r, i) => (
            <div key={i} className="rounded-xl border border-[var(--border)] bg-white p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                  <Lightbulb className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{r.titre}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${IMPACT_STYLE[r.impact]}`}>
                      impact {r.impact}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${EFFORT_STYLE[r.effort]}`}>
                      effort {r.effort}
                    </span>
                  </div>

                  <dl className="mt-2 space-y-1.5 text-sm">
                    <Line label="Constat" value={r.constat} />
                    <Line label="Hypothèse" value={r.hypothese} />
                    <Line label="Proposition" value={r.proposition} />
                  </dl>

                  {r.prompt_dev && <CopyPrompt text={r.prompt_dev} />}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!analysis && llmReady && (
        <p className="text-sm text-[var(--muted)]">
          Aucune analyse encore. Cliquez sur « Lancer l&apos;analyse » pour obtenir vos
          premières recommandations.
        </p>
      )}
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="inline font-medium text-[var(--muted)]">{label} : </dt>
      <dd className="inline text-[var(--ink-soft)]">{value}</dd>
    </div>
  );
}
