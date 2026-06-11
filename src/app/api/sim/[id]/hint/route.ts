import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { generateHint } from "@/lib/simulator";
import { EvaluatorNotConfiguredError } from "@/lib/evaluator";

export const dynamic = "force-dynamic";

// POST /api/sim/{id}/hint — un indice ciblé (mini-scène N2).
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
    const hint = await generateHint(id);
    return NextResponse.json({ hint });
  } catch (e) {
    if (e instanceof EvaluatorNotConfiguredError) {
      return NextResponse.json(
        { error: "evaluateur_non_configure", message: "Indice indisponible sans MISTRAL_API_KEY." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "echec" }, { status: 502 });
  }
}
