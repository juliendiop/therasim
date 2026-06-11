import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { tenantCanAccess } from "@/lib/entitlements";
import { getNextDrill } from "@/lib/next-drill";

export const dynamic = "force-dynamic";

// GET /f/{framework_id}/entrainement[?competency=code]
// Sélectionne le drill recommandé (routage §5.4) et redirige vers le lecteur.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ framework_id: string }> },
) {
  const { framework_id } = await params;
  const competency = req.nextUrl.searchParams.get("competency") || undefined;
  const exclude = req.nextUrl.searchParams.get("not") || undefined;
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  if (!(await tenantCanAccess(user.tenantId, framework_id)))
    return NextResponse.redirect(new URL("/catalogue", req.nextUrl.origin));

  const result = await getNextDrill(user.id, framework_id, competency, exclude);
  // Si on s'entraîne sur une compétence précise, on garde le "focus" pour rester dessus.
  const suffix = competency ? `?focus=${competency}` : "";
  const url = result.drillId
    ? new URL(`/drills/${result.drillId}${suffix}`, req.nextUrl.origin)
    : new URL(`/f/${framework_id}?vide=1`, req.nextUrl.origin);

  return NextResponse.redirect(url);
}
