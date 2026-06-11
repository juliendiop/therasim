import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { tenantCanAccess } from "@/lib/entitlements";
import { buildFrameworkDetail } from "@/lib/progress";

export const dynamic = "force-dynamic";

// GET /api/me/progress/{framework_id} — carte détaillée d'un référentiel (spec §5.6).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ framework_id: string }> },
) {
  const { framework_id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  if (!(await tenantCanAccess(user.tenantId, framework_id)))
    return NextResponse.json({ error: "accès refusé" }, { status: 403 });
  const detail = await buildFrameworkDetail(user.id, framework_id);
  if (!detail) return NextResponse.json({ error: "référentiel introuvable" }, { status: 404 });
  return NextResponse.json(detail);
}
