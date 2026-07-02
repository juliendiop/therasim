import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { userCanAccess } from "@/lib/entitlements";
import { publicDrill } from "@/lib/drill-view";

export const dynamic = "force-dynamic";

// GET /api/drills/{id} — détail d'un drill (rappel, stimulus, options si reconnaissance).
// Les champs is_best/score/feedback des options ne sont JAMAIS exposés ici.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  const drill = await prisma.drill.findUnique({ where: { id } });
  if (!drill) return NextResponse.json({ error: "drill introuvable" }, { status: 404 });
  if (!(await userCanAccess(user, drill.frameworkId)))
    return NextResponse.json({ error: "accès refusé" }, { status: 403 });
  return NextResponse.json(publicDrill(drill));
}
