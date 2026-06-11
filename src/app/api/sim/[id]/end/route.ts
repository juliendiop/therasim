import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { endSimulation } from "@/lib/simulator";
import { EvaluatorNotConfiguredError } from "@/lib/evaluator";

export const dynamic = "force-dynamic";

// POST /api/sim/{id}/end — clôt l'entretien, calcule le débrief, alimente la carte.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "non authentifié" }, { status: 401 });

  const session = await prisma.simSession.findUnique({ where: { id } });
  if (!session || session.userId !== user.id) {
    return NextResponse.json({ error: "session introuvable" }, { status: 404 });
  }

  try {
    const debrief = await endSimulation(id);
    return NextResponse.json({ debrief });
  } catch (e) {
    if (e instanceof EvaluatorNotConfiguredError) {
      return NextResponse.json(
        {
          error: "evaluateur_non_configure",
          message: "Le débrief nécessite MISTRAL_API_KEY (évaluateur LLM).",
        },
        { status: 503 },
      );
    }
    console.error(e);
    return NextResponse.json({ error: "echec_debrief" }, { status: 502 });
  }
}
