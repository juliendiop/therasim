import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  consumeMagicToken,
  createSessionToken,
  setSessionCookie,
  type Role,
} from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// POST /api/auth/reset-password — body { token, password }
// Consomme le token (usage unique, 60 min), pose le nouveau mot de passe,
// et ouvre directement la session (l'utilisateur vient de prouver son email).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = String(body.token ?? "");
  const password = String(body.password ?? "");

  if (!token) return NextResponse.json({ error: "token manquant" }, { status: 400 });
  if (password.length < 8) {
    return NextResponse.json(
      { error: "mot_de_passe_court", message: "8 caractères minimum." },
      { status: 400 },
    );
  }

  const result = await consumeMagicToken(token);
  if (!result) {
    return NextResponse.json(
      {
        error: "token_invalide",
        message: "Ce lien est expiré ou a déjà été utilisé. Refaites une demande.",
      },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { email: result.email } });
  if (!user) {
    return NextResponse.json({ error: "compte introuvable" }, { status: 404 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password) },
  });

  const sessionToken = await createSessionToken({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role as Role,
  });
  await setSessionCookie(sessionToken);
  await logAudit({
    action: "password_reset",
    email: user.email,
    tenantId: user.tenantId,
    userId: user.id,
  });

  const redirect = user.role === "super_admin" ? "/admin" : "/accueil";
  return NextResponse.json({ ok: true, redirect });
}
