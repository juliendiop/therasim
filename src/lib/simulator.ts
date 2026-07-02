// Moteur du simulateur N3 (entretien simulé complet).
// - Patient incarné par un LLM, RÉACTIF à la qualité du praticien.
// - Fin libre (bouton « Terminer ») ; débrief sommatif complet.
// - Le débrief écrit des Attempt (source='simulation') -> même carte que les drills.

import { prisma } from "./prisma";
import { llmChat, llmChatStream, type ChatMsg } from "./llm";
import { normalizeNote, PALIER_LABEL } from "./mastery";
import { recordAttempt } from "./attempts";

const FALLBACK_OPENER = "Bonjour… je ne sais pas trop par où commencer, en fait.";

function patientSystemPrompt(frameworkNom: string, titre: string, contexte: string): string {
  return [
    "Tu incarnes un PATIENT en consultation (jeu de rôle de formation). Reste strictement dans le personnage.",
    `Cas : ${titre}. ${contexte}`,
    `Le praticien s'entraîne à l'approche « ${frameworkNom} ».`,
    "Règles de jeu :",
    "- Réponds en 1 à 3 phrases, en langage parlé, en français, à la première personne.",
    "- Sois RÉACTIF au style du praticien : s'il te confronte, te juge ou te fait la morale, tu te braques et tu résistes ; s'il t'écoute, te reflète, te valorise et respecte ton autonomie, tu t'ouvres et tu explores davantage.",
    "- Tu n'es pas complaisant : tu ne « guéris » pas en un échange, ton ambivalence est réaliste.",
    "- Ne sors JAMAIS du rôle, ne donne aucun méta-commentaire, ne décris pas tes émotions entre parenthèses sauf brièvement si naturel.",
  ].join("\n");
}

async function loadContext(sessionId: string) {
  const session = await prisma.simSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error("session introuvable");
  const [scenario, framework, messages] = await Promise.all([
    prisma.scenario.findUnique({ where: { id: session.scenarioId } }),
    prisma.framework.findUnique({ where: { id: session.frameworkId } }),
    prisma.simMessage.findMany({ where: { sessionId }, orderBy: { turn: "asc" } }),
  ]);
  return { session, scenario, framework, messages };
}

/** Démarre une simulation (N3) ou une mini-scène (N2) selon `kind`. */
export async function startSimulation(input: {
  userId: string;
  tenantId: string;
  frameworkId: string;
  scenarioId: string;
  kind?: "simulation" | "miniscene";
  focus?: string[]; // mini-scène : codes des compétences ciblées
  maxTurns?: number; // mini-scène : borne de tours
}) {
  const scenario = await prisma.scenario.findUnique({ where: { id: input.scenarioId } });
  const framework = await prisma.framework.findUnique({ where: { id: input.frameworkId } });
  if (!scenario || !framework || scenario.frameworkId !== framework.id) {
    throw new Error("cas/référentiel invalide");
  }

  const session = await prisma.simSession.create({
    data: {
      userId: input.userId,
      tenantId: input.tenantId,
      frameworkId: input.frameworkId,
      scenarioId: input.scenarioId,
      kind: input.kind ?? "simulation",
      focus: input.focus ?? undefined,
      maxTurns: input.maxTurns ?? null,
    },
  });

  // Première réplique du patient (LLM si dispo, sinon ouverture neutre).
  let opener = FALLBACK_OPENER;
  try {
    const sys = patientSystemPrompt(framework.nom, scenario.titre, scenario.contexte ?? "");
    opener = (
      await llmChat(
        "patient",
        [
          { role: "system", content: sys },
          {
            role: "user",
            content:
              "(Le praticien vous accueille et vous invite à parler. Dites votre première phrase, avec vos mots.)",
          },
        ],
        { temperature: 0.8, maxTokens: 1024 },
      )
    ).trim();
  } catch {
    // Pas de clé Mistral : on démarre quand même avec l'ouverture neutre.
  }

  await prisma.simMessage.create({
    data: { sessionId: session.id, role: "patient", content: opener, turn: 0 },
  });

  return { sessionId: session.id, opener };
}

/**
 * Un tour, en flux : enregistre la réplique du praticien puis renvoie un
 * générateur des fragments de la réponse du patient (streaming vers l'UI).
 * La réponse complète est persistée à la fin du flux ; en cas d'interruption,
 * le texte déjà reçu est persisté pour garder la conversation cohérente.
 */
export async function patientReplyStream(sessionId: string, learnerText: string) {
  const { session, scenario, framework, messages } = await loadContext(sessionId);
  if (session.statut !== "en_cours") throw new Error("simulation terminée");
  if (!scenario || !framework) throw new Error("contexte invalide");

  const nextTurn = (messages.at(-1)?.turn ?? -1) + 1;

  const sys = patientSystemPrompt(framework.nom, scenario.titre, scenario.contexte ?? "");
  const history: ChatMsg[] = messages.map((m) => ({
    role: m.role === "patient" ? "assistant" : "user",
    content: m.content,
  }));
  // Le flux LLM est ouvert AVANT d'écrire le tour en base : une erreur de
  // configuration (clé absente…) remonte proprement, sans tour fantôme.
  const upstream = await llmChatStream(
    "patient",
    [{ role: "system", content: sys }, ...history, { role: "user", content: learnerText }],
    { temperature: 0.8, maxTokens: 1024 },
  );

  await prisma.simMessage.create({
    data: { sessionId, role: "apprenant", content: learnerText, turn: nextTurn },
  });

  async function* stream(): AsyncGenerator<string, void, unknown> {
    let full = "";
    try {
      for await (const chunk of upstream) {
        full += chunk;
        yield chunk;
      }
    } finally {
      const content = full.trim();
      if (content) {
        await prisma.simMessage.create({
          data: { sessionId, role: "patient", content, turn: nextTurn + 1 },
        });
      }
    }
  }
  return { stream: stream() };
}

/** Indice à la demande (mini-scène N2) : un conseil ciblé sur les compétences travaillées. */
export async function generateHint(sessionId: string): Promise<string> {
  const { session, scenario, framework, messages } = await loadContext(sessionId);
  if (!scenario || !framework) throw new Error("contexte invalide");

  const focus = Array.isArray(session.focus) ? (session.focus as string[]) : [];
  const comps = await prisma.competency.findMany({
    where: { gridId: framework.gridId, code: { in: focus } },
  });
  const focusNoms = comps.map((c) => c.nom).join(" et ");
  const lastPatient = [...messages].reverse().find((m) => m.role === "patient");

  const sys = [
    `Tu es un superviseur clinique (approche « ${framework.nom} »).`,
    `Le praticien s'entraîne à mobiliser : ${focusNoms || "les compétences ciblées"}.`,
    "Donne UN indice bref (1 phrase), concret et actionnable, pour l'aider à répondre — SANS lui donner la réplique toute faite.",
  ].join("\n");
  const user = lastPatient
    ? `Dernière réplique du patient : « ${lastPatient.content} ». Quel indice ?`
    : "Quel indice pour bien démarrer ?";

  return (
    await llmChat(
      "evaluateur",
      [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      { temperature: 0.5, maxTokens: 512 },
    )
  ).trim();
}

type DebriefScore = {
  competency_id: string;
  note: number; // 1..5
  justification: string;
  evidence: string;
  non_evalue: boolean;
};
export type LevelUp = { competency_id: string; nom: string; palier: string };
export type Debrief = {
  scores: DebriefScore[];
  narrative: string;
  moments: { quote: string; comment: string }[];
  level_ups?: LevelUp[];
};

/**
 * Termine la simulation : débrief sommatif + écriture des Attempt dans la carte.
 * `selfAssessment` (optionnel) = auto-évaluation de l'apprenant AVANT de voir la
 * note IA — { competency_code: note 1..5 }. Stockée à part (jamais mêlée au
 * débrief IA), simplement rejouée par le client pour la comparaison.
 */
export async function endSimulation(
  sessionId: string,
  selfAssessment?: Record<string, number>,
) {
  const { session, scenario, framework, messages } = await loadContext(sessionId);
  if (session.statut === "terminee" && session.debrief) {
    return session.debrief as unknown as Debrief;
  }
  if (!scenario || !framework) throw new Error("contexte invalide");

  let competencies = await prisma.competency.findMany({
    where: { gridId: framework.gridId },
    orderBy: { ordre: "asc" },
  });

  // Mini-scène (N2) : on ne débriefe que les 2 compétences ciblées.
  const focus = Array.isArray(session.focus) ? (session.focus as string[]) : null;
  if (session.kind === "miniscene" && focus && focus.length > 0) {
    competencies = competencies.filter((c) => focus.includes(c.code));
  }

  const transcript = messages
    .map((m) => `${m.role === "patient" ? "PATIENT" : "PRATICIEN"}: ${m.content}`)
    .join("\n");

  const grille = competencies
    .map(
      (c) =>
        `- ${c.code} (${c.nom}) | 1:${c.ancrage1 ?? ""} | 3:${c.ancrage3 ?? ""} | 5:${c.ancrage5 ?? ""}`,
    )
    .join("\n");

  const sys = [
    `Tu es un superviseur clinique. Tu évalues un entretien simulé (approche « ${framework.nom} »).`,
    "Pour CHAQUE compétence de la grille, donne une note de 1 à 5 selon les ancrages, avec une justification courte et une citation (evidence) tirée du verbatim du PRATICIEN.",
    "Si une compétence n'a pas pu être observée, mets non_evalue=true (elle ne sera pas comptée).",
    "Ajoute un retour narratif global (narrative) et 2 à 3 moments clés (moments : citation + commentaire).",
    'Réponds STRICTEMENT en JSON : {"scores":[{"competency_id":str,"note":1..5,"justification":str,"evidence":str,"non_evalue":bool}],"narrative":str,"moments":[{"quote":str,"comment":str}]}',
  ].join("\n");

  const user = `GRILLE DE COMPÉTENCES :\n${grille}\n\nVERBATIM DE L'ENTRETIEN :\n${transcript}`;

  const raw = await llmChat(
    "evaluateur",
    [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    { temperature: 0.2, json: true, maxTokens: 8192 },
  );
  const parsed = JSON.parse(raw) as Partial<Debrief>;

  const debrief: Debrief = {
    scores: Array.isArray(parsed.scores) ? (parsed.scores as DebriefScore[]) : [],
    narrative: String(parsed.narrative ?? ""),
    moments: Array.isArray(parsed.moments) ? parsed.moments : [],
  };

  // Écrit un Attempt par compétence évaluée -> alimente la carte (spec §4.2 / §5.5).
  // Collecte au passage les franchissements de palier notables (solide/maîtrisé), à
  // fêter côté client.
  const nomByCode = new Map(competencies.map((c) => [c.code, c.nom]));
  const validCodes = new Set(competencies.map((c) => c.code));
  const levelUps: LevelUp[] = [];
  for (const s of debrief.scores) {
    if (s.non_evalue || !validCodes.has(s.competency_id)) continue;
    // Note IA absente/non numérique : on ignore plutôt que de corrompre la carte.
    if (!Number.isFinite(Number(s.note))) continue;
    const result = await recordAttempt({
      userId: session.userId,
      tenantId: session.tenantId,
      frameworkId: session.frameworkId,
      competencyId: s.competency_id,
      source: "simulation",
      sourceRef: session.id,
      score: normalizeNote(s.note),
      raw: { note: s.note, justification: s.justification, evidence: s.evidence },
    });
    if (result.milestone) {
      levelUps.push({
        competency_id: s.competency_id,
        nom: nomByCode.get(s.competency_id) ?? s.competency_id,
        palier: PALIER_LABEL[result.palierAfter],
      });
    }
  }
  if (levelUps.length > 0) debrief.level_ups = levelUps;

  await prisma.simSession.update({
    where: { id: session.id },
    data: {
      statut: "terminee",
      endedAt: new Date(),
      debrief: debrief as unknown as object,
      selfAssessment:
        selfAssessment && Object.keys(selfAssessment).length > 0
          ? (selfAssessment as unknown as object)
          : undefined,
    },
  });

  return debrief;
}
