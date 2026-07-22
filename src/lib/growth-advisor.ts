// Conseiller de croissance : lit les mesures de l'entonnoir et demande à l'IA
// des pistes d'optimisation de conversion PRIORISÉES, chacune accompagnée d'un
// prompt prêt à copier-coller pour lancer le développement.
// Principe : l'IA PROPOSE, le porteur VALIDE et déclenche — rien d'autonome.
import "server-only";
import { funnelSummary, FUNNEL_STEPS } from "./funnel";
import { llmChat, isLlmConfigured } from "./llm";
import { getConfig, setConfig } from "./config";

const ANALYSIS_KEY = "growth.last_analysis";

export type Reco = {
  titre: string;
  constat: string; // ce que montrent les données
  hypothese: string; // pourquoi ça décroche
  proposition: string; // le changement suggéré
  impact: "fort" | "moyen" | "faible";
  effort: "faible" | "moyen" | "élevé";
  prompt_dev: string; // à copier-coller dans une IA de dev
};

export type Analysis = {
  generatedAt: string; // ISO
  periodDays: number;
  totalVisits: number;
  lowVolume: boolean;
  synthese: string;
  recommandations: Reco[];
};

const LOW_VOLUME_THRESHOLD = 100;

export async function getLastAnalysis(): Promise<Analysis | null> {
  const raw = await getConfig(ANALYSIS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Analysis;
  } catch {
    return null;
  }
}

export { isLlmConfigured };

/**
 * Lance une analyse : agrège l'entonnoir sur 30 j, interroge l'IA, structure
 * et sauvegarde le résultat. Renvoie l'analyse. Lève si l'IA n'est pas configurée.
 */
export async function runAnalysis(): Promise<Analysis> {
  if (!isLlmConfigured()) {
    throw new Error("Aucun fournisseur IA configuré (voir /admin/modeles).");
  }

  const periodDays = 30;
  const to = new Date();
  const from = new Date(to.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const { steps, total } = await funnelSummary({ from, to });
  const lowVolume = total < LOW_VOLUME_THRESHOLD;

  const funnelText = steps
    .map((s) => {
      const conv = s.fromPrev === null ? "—" : `${Math.round(s.fromPrev * 100)}%`;
      return `- ${s.label} : ${s.count} (conversion depuis l'étape précédente : ${conv})`;
    })
    .join("\n");

  const system = `Tu es un expert growth / CRO (optimisation du taux de conversion) pour un produit SaaS B2C+B2B.
Le produit s'appelle MELETA : un outil d'entraînement clinique par compétences pour thérapeutes, coachs et écoles de formation. On s'entraîne sur des cas cliniques (exercices QCM gratuits, mini-scènes et entretiens simulés par IA payés en crédits). Modèle : essai gratuit (1 domaine + crédits offerts à l'inscription), puis packs de crédits et forfaits d'abonnement.
Pages clés de l'acquisition : "/" (landing avec une démo jouable sans compte), "/tarifs", "/inscription", "/blog", et l'espace connecté (/accueil, /catalogue, exercices, /credits).

Ta mission : à partir des mesures d'entonnoir fournies, proposer 3 à 5 optimisations de conversion PRIORISÉES et CONCRÈTES, actionnables dans le code de l'app.
Règles :
- Sois honnête sur la fiabilité statistique : si le volume est faible, dis-le et privilégie des améliorations de bon sens (UX, clarté, réassurance) plutôt que des conclusions chiffrées.
- Chaque recommandation doit viser une étape précise où les gens décrochent.
- Pour chaque recommandation, rédige un "prompt_dev" : un prompt COMPLET et autonome, en français, que l'utilisateur copiera-collera tel quel dans un assistant de développement IA pour implémenter le changement. Le prompt doit décrire le quoi et le pourquoi, mentionner qu'il s'agit d'une app Next.js 16 / Tailwind v4, et demander de rester cohérent avec le design system existant (tons papier, teal, ocre).
- Reste factuel, pas de survente marketing (l'outil est "formatif, non certifiant").

Réponds UNIQUEMENT en JSON valide, sans texte autour, au format :
{
  "synthese": "2-3 phrases résumant le diagnostic principal",
  "recommandations": [
    {
      "titre": "...",
      "constat": "ce que montrent les données",
      "hypothese": "pourquoi ça décroche",
      "proposition": "le changement suggéré",
      "impact": "fort|moyen|faible",
      "effort": "faible|moyen|élevé",
      "prompt_dev": "prompt complet à copier-coller"
    }
  ]
}`;

  const user = `Mesures de l'entonnoir d'acquisition sur les ${periodDays} derniers jours :

${funnelText}

Total de visites sur la landing : ${total}
${lowVolume ? `ATTENTION : volume faible (< ${LOW_VOLUME_THRESHOLD}). Les taux sont indicatifs, pas fiables statistiquement.` : ""}

Propose les optimisations de conversion.`;

  const raw = await llmChat(
    "generation",
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { json: true, maxTokens: 4000 },
  );

  const parsed = parseAnalysis(raw);
  const analysis: Analysis = {
    generatedAt: new Date().toISOString(),
    periodDays,
    totalVisits: total,
    lowVolume,
    synthese: parsed.synthese,
    recommandations: parsed.recommandations,
  };

  await setConfig(ANALYSIS_KEY, JSON.stringify(analysis));
  return analysis;
}

// Parse défensif : l'IA renvoie parfois le JSON entouré de texte ou de balises.
function parseAnalysis(raw: string): { synthese: string; recommandations: Reco[] } {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1) text = text.slice(start, end + 1);

  const data = JSON.parse(text) as {
    synthese?: string;
    recommandations?: Partial<Reco>[];
  };
  const recommandations: Reco[] = (data.recommandations ?? []).map((r) => ({
    titre: String(r.titre ?? "Sans titre"),
    constat: String(r.constat ?? ""),
    hypothese: String(r.hypothese ?? ""),
    proposition: String(r.proposition ?? ""),
    impact: (["fort", "moyen", "faible"].includes(String(r.impact)) ? r.impact : "moyen") as Reco["impact"],
    effort: (["faible", "moyen", "élevé"].includes(String(r.effort)) ? r.effort : "moyen") as Reco["effort"],
    prompt_dev: String(r.prompt_dev ?? ""),
  }));
  return { synthese: String(data.synthese ?? ""), recommandations };
}

// Ré-exporté pour l'affichage de l'ordre des étapes si besoin.
export { FUNNEL_STEPS };
