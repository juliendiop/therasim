import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { userCanAccess } from "@/lib/entitlements";
import { recordAttempt, type RecordAttemptResult } from "@/lib/attempts";
import { parseOptions } from "@/lib/drill-view";
import { normalizeNote, PALIER_LABEL } from "@/lib/mastery";
import {
  EvaluatorNotConfiguredError,
  evaluateMonoCompetence,
} from "@/lib/evaluator";

export const dynamic = "force-dynamic";

// POST /api/drills/{id}/attempt — spec §4.4 / §6.
// Body reconnaissance : { option_index }. Body production : { answer }.
// Renvoie feedback + score + (option) réaction patient ; met à jour la carte (§5.5).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const drill = await prisma.drill.findUnique({ where: { id } });
  if (!drill) return NextResponse.json({ error: "drill introuvable" }, { status: 404 });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  if (!(await userCanAccess(user, drill.frameworkId)))
    return NextResponse.json({ error: "accès refusé" }, { status: 403 });
  const body = await req.json().catch(() => ({}));

  // ---- Mode reconnaissance : aucun appel LLM (spec §4.3) ----
  if (drill.mode === "reconnaissance") {
    const options = parseOptions(drill.options);
    const idx = Number(body.option_index);
    if (!Number.isInteger(idx) || idx < 0 || idx >= options.length) {
      return NextResponse.json({ error: "option_index invalide" }, { status: 400 });
    }
    const chosen = options[idx];
    const score = chosen.score; // déjà dans [0,1]

    const result = await recordAttempt({
      userId: user.id,
      tenantId: user.tenantId,
      frameworkId: drill.frameworkId,
      competencyId: drill.competencyId,
      source: "drill",
      sourceRef: drill.id,
      score,
      raw: { mode: "reconnaissance", option_index: idx, feedback: chosen.feedback },
    });

    return NextResponse.json({
      mode: "reconnaissance",
      is_best: chosen.is_best,
      score,
      feedback: chosen.feedback,
      modele_reponse: drill.modeleReponse,
      patient_reaction: chosen.is_best ? drill.patientReactionSiBon : null,
      level_up: await levelUpPayload(result, drill.frameworkId, drill.competencyId),
    });
  }

  // ---- Mode production : évaluateur mono-compétence (spec §4.3) ----
  const answer = String(body.answer ?? "").trim();
  if (!answer) {
    return NextResponse.json({ error: "réponse vide" }, { status: 400 });
  }

  const competency = await prisma.competency.findFirst({
    where: { gridId: await gridIdOf(drill.frameworkId), code: drill.competencyId },
  });

  try {
    const evaluation = await evaluateMonoCompetence({
      competenceNom: competency?.nom ?? drill.competencyId,
      ancrage1: competency?.ancrage1,
      ancrage3: competency?.ancrage3,
      ancrage5: competency?.ancrage5,
      stimulus: drill.stimulus,
      modeleReponse: drill.modeleReponse,
      reponseApprenant: answer,
    });

    // Un item "non évalué" n'écrit PAS d'attempt (spec §5.1).
    if (evaluation.non_evalue) {
      return NextResponse.json({
        mode: "production",
        non_evalue: true,
        feedback: evaluation.justification,
        modele_reponse: drill.modeleReponse,
      });
    }

    const score = normalizeNote(evaluation.score);
    const result = await recordAttempt({
      userId: user.id,
      tenantId: user.tenantId,
      frameworkId: drill.frameworkId,
      competencyId: drill.competencyId,
      source: "drill",
      sourceRef: drill.id,
      score,
      raw: {
        mode: "production",
        note: evaluation.score,
        justification: evaluation.justification,
        evidence: evaluation.evidence,
      },
    });

    return NextResponse.json({
      mode: "production",
      non_evalue: false,
      note: evaluation.score,
      score,
      feedback: evaluation.justification,
      evidence: evaluation.evidence,
      suggested_better_response: evaluation.suggested_better_response,
      modele_reponse: drill.modeleReponse,
      patient_reaction: evaluation.score >= 4 ? drill.patientReactionSiBon : null,
      level_up: await levelUpPayload(result, drill.frameworkId, drill.competencyId, competency?.nom),
    });
  } catch (err) {
    if (err instanceof EvaluatorNotConfiguredError) {
      return NextResponse.json(
        {
          error: "evaluateur_non_configure",
          message:
            "Le mode production nécessite la clé API du fournisseur IA choisi. Utilisez un drill de reconnaissance ou configurez la clé.",
        },
        { status: 503 },
      );
    }
    console.error(err);
    return NextResponse.json({ error: "echec_evaluation" }, { status: 502 });
  }
}

async function gridIdOf(frameworkId: string): Promise<string> {
  const f = await prisma.framework.findUnique({ where: { id: frameworkId } });
  return f?.gridId ?? "";
}

/** Payload de célébration si l'essai a fait franchir un palier notable (solide/maîtrisé). */
async function levelUpPayload(
  result: RecordAttemptResult,
  frameworkId: string,
  competencyId: string,
  nomHint?: string | null,
): Promise<{ competence: string; palier: string } | null> {
  if (!result.milestone) return null;
  const nom =
    nomHint ??
    (
      await prisma.competency.findFirst({
        where: { gridId: await gridIdOf(frameworkId), code: competencyId },
      })
    )?.nom ??
    competencyId;
  return { competence: nom, palier: PALIER_LABEL[result.palierAfter] };
}
