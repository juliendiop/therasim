import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createMagicToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/auth/magic-link — body { email }
// Crée un lien de connexion. En dev (pas d'email configuré), le lien est renvoyé
// dans la réponse pour pouvoir se connecter sans infra email. En prod : à envoyer
// par email (Resend) — voir 04_RESTE_A_FAIRE.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "email invalide" }, { status: 400 });
  }

  // Tenant cible : celui de l'utilisateur s'il existe, sinon le tenant public (B2C).
  const existing = await prisma.user.findUnique({ where: { email } });
  let tenantId = existing?.tenantId;
  if (!tenantId) {
    const pub = await prisma.tenant.findUnique({ where: { slug: "public" } });
    if (!pub) return NextResponse.json({ error: "tenant public absent" }, { status: 500 });
    tenantId = pub.id;
  }

  const token = await createMagicToken(email, tenantId);
  const base = process.env.APP_BASE_URL || req.nextUrl.origin;
  const link = `${base}/api/auth/callback?token=${token}`;

  // eslint-disable-next-line no-console
  console.log(`[magic-link] ${email} -> ${link}`);

  const isDev = process.env.NODE_ENV !== "production";
  return NextResponse.json({ sent: true, devLink: isDev ? link : undefined });
}
