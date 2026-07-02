import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { userCanAccess } from "@/lib/entitlements";
import { getNextDrill } from "@/lib/next-drill";

export const dynamic = "force-dynamic";

// GET /api/frameworks/{id}/drills/next — drill recommandé (routage §5.4).
// ?competency=<code> pour cibler une compétence précise (boutons "s'entraîner").
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const competency = req.nextUrl.searchParams.get("competency") || undefined;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  if (!(await userCanAccess(user, id)))
    return NextResponse.json({ error: "accès refusé" }, { status: 403 });

  const result = await getNextDrill(user.id, id, competency);
  if (result.drillId === null) {
    return NextResponse.json({ error: result.reason }, { status: 404 });
  }
  return NextResponse.json({
    drill_id: result.drillId,
    competency_id: result.competencyId,
  });
}
