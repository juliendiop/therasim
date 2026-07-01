import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { consumeMagicToken, createSessionToken, setSessionCookie } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/auth/callback?token=... — valide le lien magique, ouvre la session.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/login?erreur=token", req.nextUrl.origin));

  const result = await consumeMagicToken(token);
  if (!result) {
    return NextResponse.redirect(new URL("/login?erreur=expire", req.nextUrl.origin));
  }

  // Trouver ou créer l'utilisateur (apprenant par défaut dans son tenant).
  const user = await prisma.user.upsert({
    where: { email: result.email },
    update: {},
    create: { email: result.email, tenantId: result.tenantId, role: "learner" },
  });

  const sessionToken = await createSessionToken({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role as "super_admin" | "tenant_admin" | "learner",
  });
  await setSessionCookie(sessionToken);
  await logAudit({
    action: "login",
    email: user.email,
    tenantId: user.tenantId,
    userId: user.id,
    meta: { method: "magic" },
  });

  const dest = user.role === "super_admin" ? "/admin" : "/catalogue";
  return NextResponse.redirect(new URL(dest, req.nextUrl.origin));
}
