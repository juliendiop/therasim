/**
 * Harnais de calibration de l'évaluateur (mode "production").
 *
 * Mesure l'accord entre les notes de l'IA et un « gold set » de réponses dont le
 * niveau attendu est connu (fortes ≈ modèle → 5, faibles ≈ ancrage 1 → 1-2,
 * hors-sujet → non_evalue). Rejoue le VRAI prompt de l'évaluateur
 * (src/lib/evaluator-core.ts) → mesure fidèle et reproductible.
 *
 * Usage :
 *   MISTRAL_API_KEY=... npm run calibrate
 *   (modèle : $CALIBRATION_MODEL ou $MISTRAL_MODEL ou mistral-small-latest)
 *
 * Le gold set ci-dessous est un PREMIER JET dérivé du contenu seedé. Il gagnerait
 * à être relu/étendu par un clinicien (notamment les niveaux « moyens » 2-4, plus
 * subjectifs). C'est ce fichier qu'on enrichit pour durcir la calibration.
 */
import "dotenv/config";
import {
  EVALUATOR_SYSTEM_PROMPT,
  buildEvaluationUserPrompt,
  parseEvaluation,
} from "../src/lib/evaluator-core";

type Sample = { response: string; expected: number | null; note?: string };
type Block = {
  competence: string;
  ancrage1: string;
  ancrage3: string;
  ancrage5: string;
  stimulus: string;
  modele: string;
  samples: Sample[];
};

// --- Gold set (dérivé du contenu seedé) -------------------------------------
const GOLD: Block[] = [
  {
    competence: "Reflets",
    ancrage1: "Répète mot à mot ou n'écoute pas.",
    ancrage3: "Reflet simple qui paraphrase.",
    ancrage5: "Reflet complexe : ajoute du sens, nomme l'émotion sous-jacente.",
    stimulus: "Le soir, c'est le seul moment où je décompresse vraiment.",
    modele: "Ce moment, c'est votre soupape pour relâcher la pression de la journée.",
    samples: [
      { response: "Ce moment, c'est votre façon de relâcher la pression de la journée.", expected: 5, note: "reflet complexe" },
      { response: "Vous aimez bien boire le soir.", expected: 2, note: "paraphrase pauvre" },
      { response: "Donc vous buvez tous les soirs.", expected: 1, note: "constat accusateur" },
      { response: "je sais pas quoi dire", expected: null, note: "méta → non_evalue" },
    ],
  },
  {
    competence: "Questions ouvertes",
    ancrage1: "Enchaîne des questions fermées ou orientées.",
    ancrage3: "Quelques questions ouvertes, parfois intrusives.",
    ancrage5: "Questions ouvertes qui explorent la motivation et respectent le cadre.",
    stimulus: "Je suis là parce que mon médecin a insisté, je vois pas le problème.",
    modele: "Qu'est-ce qui rendrait ce temps utile pour vous, malgré tout ?",
    samples: [
      { response: "Qu'est-ce qui rendrait ce temps utile pour vous, malgré tout ?", expected: 5 },
      { response: "Vous ne pensez pas que vous devriez réduire ?", expected: 1, note: "fermée + confrontante" },
    ],
  },
  {
    competence: "Empathie",
    ancrage1: "Réagit aux faits sans accueillir le vécu ; juge ou minimise.",
    ancrage3: "Nomme l'émotion de surface, reste un peu en retrait.",
    ancrage5: "Reflète finement le vécu et le sens, le patient se sent compris.",
    stimulus: "J'ai honte de ne pas y arriver, à mon âge.",
    modele: "Cette honte est difficile à porter, surtout après tant d'efforts.",
    samples: [
      { response: "Cette honte est lourde à porter, surtout après tous vos efforts.", expected: 5 },
      { response: "Il ne faut pas avoir honte, beaucoup de gens y arrivent.", expected: 2, note: "minimise" },
      { response: "askdjh test", expected: null, note: "charabia → non_evalue" },
    ],
  },
  {
    competence: "Rouler avec la résistance",
    ancrage1: "Confronte, insiste, entre en lutte avec le patient.",
    ancrage3: "Évite l'affrontement mais sans réorienter.",
    ancrage5: "Accueille la résistance et la réoriente avec souplesse.",
    stimulus: "De toute façon, le diabète, c'est génétique chez moi, l'activité n'y changera rien.",
    modele:
      "Vous doutez que ça serve — et pourtant vous êtes là aujourd'hui. Qu'est-ce qui compterait assez pour tenter, malgré tout ?",
    samples: [
      { response: "Vous n'êtes pas convaincue que ça change quelque chose, et vous êtes quand même venue. Qu'est-ce qui vous ferait essayer malgré tout ?", expected: 5 },
      { response: "C'est faux, l'activité physique réduit clairement la glycémie, c'est prouvé.", expected: 1, note: "contre-argumente" },
    ],
  },
  {
    competence: "Défusion cognitive",
    ancrage1: "Discute le contenu de la pensée comme une vérité à corriger.",
    ancrage3: "Note que c'est « une pensée » sans la travailler.",
    ancrage5: "Aide à observer la pensée comme un événement mental, sans s'y identifier.",
    stimulus: "Je me dis tout le temps « tu vas te ridiculiser », et c'est vrai.",
    modele:
      "Vous remarquez cette pensée « tu vas te ridiculiser » — et si on l'observait comme une phrase que l'esprit propose ?",
    samples: [
      { response: "Vous remarquez que l'esprit vous sert cette phrase « tu vas te ridiculiser » ; et si on l'observait comme une pensée, pas comme un fait ?", expected: 5 },
      { response: "Mais non, vous ne vous ridiculisez pas, regardez les faits.", expected: 1, note: "débat le contenu" },
    ],
  },
  {
    competence: "Clarification des valeurs",
    ancrage1: "Impose des objectifs ou des normes extérieures.",
    ancrage3: "Évoque ce qui compte sans le préciser.",
    ancrage5: "Fait émerger ce qui compte vraiment pour le patient, en propre.",
    stimulus: "Je veux juste que l'anxiété disparaisse, c'est tout.",
    modele: "Si l'anxiété pesait moins, qu'est-ce qui deviendrait possible et important pour vous ?",
    samples: [
      { response: "Si l'anxiété pesait moins, qu'est-ce qui deviendrait possible et compterait pour vous ?", expected: 5 },
      { response: "L'anxiété est normale, il faut l'accepter.", expected: 3, note: "idée juste mais assénée" },
      { response: "Il faut vous fixer l'objectif d'être plus sociable, c'est important.", expected: 1, note: "impose une norme" },
    ],
  },
  {
    competence: "Alliance / climat de confiance",
    ancrage1: "Ton froid ou intrusif, le patient se ferme.",
    ancrage3: "Climat correct mais neutre.",
    ancrage5: "Crée un climat chaleureux et sécurisant qui favorise la confidence.",
    stimulus: "Je ne sais pas trop si ça sert à quelque chose de parler de tout ça.",
    modele:
      "C'est légitime de se le demander. On avance à votre rythme, et vous gardez la main sur ce que vous souhaitez aborder.",
    samples: [
      { response: "C'est compréhensible de se le demander. On ira à votre rythme, vous gardez la main sur ce qu'on aborde.", expected: 5 },
      { response: "Si vous êtes là, c'est que ça sert, non ?", expected: 1, note: "confronte" },
    ],
  },
  {
    competence: "Histoire du problème",
    ancrage1: "Saute d'un sujet à l'autre sans chronologie.",
    ancrage3: "Retrace les grandes lignes.",
    ancrage5: "Reconstruit l'évolution (début, facteurs, retentissement) avec clarté.",
    stimulus:
      "Ça a commencé… enfin je ne sais plus, il y a eu le déménagement, puis mon poste qui a changé, et ma mère qui est tombée malade, tout s'est mélangé.",
    modele:
      "Pour m'y retrouver, est-ce qu'on peut reprendre dans l'ordre : à quel moment les angoisses sont-elles apparues la première fois, et que se passait-il alors ?",
    samples: [
      { response: "Reprenons dans l'ordre si vous voulez : quand les angoisses ont-elles commencé, et que se passait-il dans votre vie à ce moment-là ?", expected: 5 },
      { response: "Donc c'est le déménagement qui a tout déclenché.", expected: 2, note: "conclusion hâtive" },
    ],
  },
];

// --- Appel Mistral (JSON, température 0) -------------------------------------
async function scoreOne(block: Block, response: string): Promise<{ score: number; non_evalue: boolean }> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error("MISTRAL_API_KEY absente : impossible de calibrer.");
  const model = process.env.CALIBRATION_MODEL || process.env.MISTRAL_MODEL || "mistral-small-latest";

  const userMsg = buildEvaluationUserPrompt({
    competenceNom: block.competence,
    ancrage1: block.ancrage1,
    ancrage3: block.ancrage3,
    ancrage5: block.ancrage5,
    stimulus: block.stimulus,
    modeleReponse: block.modele,
    reponseApprenant: response,
  });

  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: EVALUATOR_SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Mistral ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content ?? "{}";
  const parsed = parseEvaluation(raw, response);
  return { score: parsed.score, non_evalue: parsed.non_evalue };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log("Calibration de l'évaluateur — gold set\n");

  let scored = 0;
  let absErrTotal = 0;
  let within1 = 0;
  let exact = 0;
  const orderingViolations: string[] = [];
  const nonEvalExpected: boolean[] = [];
  const nonEvalActual: boolean[] = [];

  for (const block of GOLD) {
    console.log(`\n### ${block.competence}`);
    const scoredSamples: { expected: number; actual: number }[] = [];

    for (const s of block.samples) {
      const r = await scoreOne(block, s.response);
      await sleep(400); // ménage le rate limit du palier gratuit

      if (s.expected === null) {
        // Cas hors-sujet : on attend non_evalue.
        nonEvalExpected.push(true);
        nonEvalActual.push(r.non_evalue);
        const ok = r.non_evalue ? "OK" : "❌";
        console.log(`  [non_evalue attendu] ${ok}  "${s.response.slice(0, 40)}"`);
        continue;
      }

      nonEvalExpected.push(false);
      nonEvalActual.push(r.non_evalue);
      const err = Math.abs(r.score - s.expected);
      scored++;
      absErrTotal += err;
      if (err === 0) exact++;
      if (err <= 1) within1++;
      scoredSamples.push({ expected: s.expected, actual: r.score });

      const flag = err === 0 ? "✓" : err === 1 ? "~" : "❌";
      const naFlag = r.non_evalue ? " (⚠ marqué non_evalue)" : "";
      console.log(
        `  attendu ${s.expected} · obtenu ${r.score}  ${flag}${naFlag}  ${s.note ?? ""}`.trimEnd(),
      );
    }

    // Ordre interne au bloc : une réponse attendue plus forte ne doit pas être notée
    // en dessous d'une réponse attendue plus faible.
    for (let i = 0; i < scoredSamples.length; i++) {
      for (let j = 0; j < scoredSamples.length; j++) {
        const a = scoredSamples[i];
        const b = scoredSamples[j];
        if (a.expected > b.expected && a.actual < b.actual) {
          orderingViolations.push(
            `${block.competence}: attendu ${a.expected}>${b.expected} mais obtenu ${a.actual}<${b.actual}`,
          );
        }
      }
    }
  }

  // --- non_evalue : précision / rappel ---
  let tp = 0, fp = 0, fn = 0;
  for (let i = 0; i < nonEvalExpected.length; i++) {
    if (nonEvalExpected[i] && nonEvalActual[i]) tp++;
    if (!nonEvalExpected[i] && nonEvalActual[i]) fp++;
    if (nonEvalExpected[i] && !nonEvalActual[i]) fn++;
  }

  console.log("\n─────────────────────────────────────");
  console.log("RÉSUMÉ");
  console.log(`  Réponses notées : ${scored}`);
  console.log(`  Erreur absolue moyenne (MAE) : ${(absErrTotal / Math.max(1, scored)).toFixed(2)} point(s)`);
  console.log(`  Exactes (delta 0) : ${exact}/${scored} (${pct(exact, scored)})`);
  console.log(`  À ±1 point : ${within1}/${scored} (${pct(within1, scored)})`);
  console.log(`  Violations d'ordre (fort < faible) : ${orderingViolations.length}`);
  orderingViolations.forEach((v) => console.log(`    - ${v}`));
  console.log(`  non_evalue : détectés ${tp}/${tp + fn} · faux positifs ${fp}`);

  // Verdict simple, orientatif.
  const maeOk = absErrTotal / Math.max(1, scored) <= 0.8;
  const within1Ok = within1 / Math.max(1, scored) >= 0.85;
  const orderOk = orderingViolations.length === 0;
  const naOk = fn === 0 && fp === 0;
  console.log("\n  Verdict :");
  console.log(`    MAE ≤ 0.8         ${maeOk ? "✓" : "❌"}`);
  console.log(`    ≥85% à ±1 point   ${within1Ok ? "✓" : "❌"}`);
  console.log(`    Ordre respecté    ${orderOk ? "✓" : "❌"}`);
  console.log(`    non_evalue net    ${naOk ? "✓" : "❌"}`);
  const allOk = maeOk && within1Ok && orderOk && naOk;
  console.log(`\n  → ${allOk ? "Calibration ACCEPTABLE ✓" : "À AMÉLIORER (ajuster prompt/ancrages/modèle) ❌"}`);
  process.exit(allOk ? 0 : 1);
}

function pct(a: number, b: number): string {
  return b === 0 ? "—" : `${Math.round((100 * a) / b)}%`;
}

main().catch((e) => {
  console.error("\nÉchec de la calibration :", e instanceof Error ? e.message : e);
  process.exit(1);
});
