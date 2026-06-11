import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { isLiveOpen } from "@/lib/live";
import { parseOptions } from "@/lib/drill-view";

export const dynamic = "force-dynamic";

// POST /api/live/{id}/answer — body { drillId, option_index }. Participant via cookie.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const participantId = (await cookies()).get(`lp_${id}`)?.value;
  if (!participantId) return NextResponse.json({ error: "non inscrit" }, { status: 401 });

  const session = await prisma.liveSession.findUnique({ where: { id } });
  if (!session) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  if (!isLiveOpen(session)) {
    return NextResponse.json({ error: "temps_ecoule" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const drillId = String(body.drillId ?? "");
  const idx = Number(body.option_index);
  if (!(session.drillIds as string[]).includes(drillId)) {
    return NextResponse.json({ error: "question invalide" }, { status: 400 });
  }

  const drill = await prisma.drill.findUnique({ where: { id: drillId } });
  if (!drill) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  const options = parseOptions(drill.options);
  if (!Number.isInteger(idx) || idx < 0 || idx >= options.length) {
    return NextResponse.json({ error: "option invalide" }, { status: 400 });
  }
  const chosen = options[idx];

  // Idempotence : on n'enregistre qu'une réponse par question.
  const existing = await prisma.liveAnswer.findFirst({
    where: { participantId, drillId },
  });
  if (!existing) {
    await prisma.liveAnswer.create({
      data: {
        sessionId: id,
        participantId,
        drillId,
        competencyId: drill.competencyId,
        optionIndex: idx,
        score: chosen.score,
      },
    });
  }

  // Mode apprentissage : feedback immédiat. Évaluation : juste l'accusé.
  if (session.mode === "apprentissage") {
    return NextResponse.json({
      feedback: chosen.feedback,
      is_best: chosen.is_best,
      score: chosen.score,
      modele_reponse: drill.modeleReponse,
    });
  }
  return NextResponse.json({ recorded: true });
}
