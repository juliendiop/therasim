import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/auth/logout — ferme la session.
export async function POST(req: NextRequest) {
  await clearSessionCookie();
  return NextResponse.redirect(new URL("/login", req.nextUrl.origin), { status: 303 });
}
