import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { buildOverview } from "@/lib/progress";

export const dynamic = "force-dynamic";

// GET /api/me/progress — vue d'ensemble : un profil par référentiel (spec §5.6).
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  const overview = await buildOverview(user.id, user.tenantId);
  return NextResponse.json(overview);
}
