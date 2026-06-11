import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/live/{id}/status — public : permet au sas d'attente de détecter le démarrage.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const s = await prisma.liveSession.findUnique({
    where: { id },
    select: { statut: true, closesAt: true },
  });
  if (!s) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  return NextResponse.json({
    statut: s.statut,
    closesAt: s.closesAt ? s.closesAt.toISOString() : null,
  });
}
