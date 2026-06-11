import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getLiveResults, roleCanManageLive } from "@/lib/live";

export const dynamic = "force-dynamic";

// GET /api/live/{id}/results — réservé au formateur (synthèse collective + individuels).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user || !roleCanManageLive(user.role)) {
    return NextResponse.json({ error: "non autorisé" }, { status: 403 });
  }
  const session = await prisma.liveSession.findUnique({ where: { id } });
  if (!session || session.tenantId !== user.tenantId) {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }

  const results = await getLiveResults(id);
  return NextResponse.json({
    statut: session.statut,
    mode: session.mode,
    closesAt: session.closesAt ? session.closesAt.toISOString() : null,
    results,
  });
}
