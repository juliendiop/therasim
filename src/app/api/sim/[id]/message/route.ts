import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { patientReply } from "@/lib/simulator";
import { EvaluatorNotConfiguredError } from "@/lib/evaluator";

export const dynamic = "force-dynamic";

// POST /api/sim/{id}/message — body { content } : un tour de l'entretien.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "non authentifié" }, { status: 401 });

  const session = await prisma.simSession.findUnique({ where: { id } });
  if (!session || session.userId !== user.id) {
    return NextResponse.json({ error: "session introuvable" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const content = String(body.content ?? "").trim();
  if (!content) return NextResponse.json({ error: "message vide" }, { status: 400 });

  try {
    const { reply } = await patientReply(id, content);
    return NextResponse.json({ reply });
  } catch (e) {
    if (e instanceof EvaluatorNotConfiguredError) {
      return NextResponse.json(
        {
          error: "evaluateur_non_configure",
          message:
            "Le simulateur nécessite MISTRAL_API_KEY (le patient est joué par un LLM). Ajoutez la clé dans .env.",
        },
        { status: 503 },
      );
    }
    console.error(e);
    return NextResponse.json({ error: "echec" }, { status: 502 });
  }
}
