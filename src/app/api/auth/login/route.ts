import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { createSessionToken, setSessionCookie, type Role } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// POST /api/auth/login — body { email, password } : connexion classique.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!email || !password) {
    return NextResponse.json({ error: "email et mot de passe requis" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Message volontairement générique (ne pas révéler si le compte existe).
  if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json(
      { error: "identifiants invalides", message: "Email ou mot de passe incorrect." },
      { status: 401 },
    );
  }

  const token = await createSessionToken({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role as Role,
  });
  await setSessionCookie(token);
  await logAudit({
    action: "login",
    email: user.email,
    tenantId: user.tenantId,
    userId: user.id,
    meta: { method: "password" },
  });

  const redirect = user.role === "super_admin" ? "/admin" : "/accueil";
  return NextResponse.json({ ok: true, redirect });
}
