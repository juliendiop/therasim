import { NextRequest, NextResponse } from "next/server";
import { setReferralCookie } from "@/lib/affiliation";

export const dynamic = "force-dynamic";

// GET /r/CODE — lien de parrainage court. Pose le cookie d'attribution
// (first-touch : ne remplace jamais un ts_ref déjà posé) puis redirige vers la
// landing. La résolution en referredByUserId se fait à l'inscription
// (voir src/lib/affiliation.ts, attributeReferralForNewUser).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  if (code) await setReferralCookie(code);
  return NextResponse.redirect(new URL("/", req.nextUrl.origin));
}
