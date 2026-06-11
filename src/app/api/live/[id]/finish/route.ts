import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { parseOptions } from "@/lib/drill-view";

export const dynamic = "force-dynamic";

// POST /api/live/{id}/finish — clôt la participation et renvoie le récap (corrigé inclus).
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const participantId = (await cookies()).get(`lp_${id}`)?.value;
  if (!participantId) return NextResponse.json({ error: "non inscrit" }, { status: 401 });

  await prisma.liveParticipant
    .update({ where: { id: participantId }, data: { finishedAt: new Date() } })
    .catch(() => null);

  const answers = await prisma.liveAnswer.findMany({
    where: { participantId },
    orderBy: { createdAt: "asc" },
  });
  const drills = await prisma.drill.findMany({
    where: { id: { in: answers.map((a) => a.drillId) } },
  });
  const drillById = new Map(drills.map((d) => [d.id, d]));

  const details = answers.map((a) => {
    const d = drillById.get(a.drillId);
    const opts = d ? parseOptions(d.options) : [];
    const best = opts.find((o) => o.is_best);
    return {
      stimulus: d?.stimulus ?? "",
      your_text: opts[a.optionIndex]?.text ?? "",
      correct_text: best?.text ?? "",
      feedback: opts[a.optionIndex]?.feedback ?? "",
      is_best: opts[a.optionIndex]?.is_best ?? false,
      score: a.score,
    };
  });

  const score = answers.length
    ? answers.reduce((s, x) => s + x.score, 0) / answers.length
    : null;

  return NextResponse.json({ score, details });
}
