import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createSessionToken, setSessionCookie, type Role } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/auth/register — inscription B2C (site public) avec mot de passe.
// body { firstName?, email, password, consent }. Crée un apprenant dans le
// tenant public, ouvre la session, redirige vers l'accueil de bienvenue.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const firstName = String(body.firstName ?? "").trim().slice(0, 60);
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const consent = Boolean(body.consent);

  if (!email.includes("@")) {
    return NextResponse.json(
      { error: "email_invalide", message: "Merci d'indiquer un email valide." },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "mot_de_passe_court", message: "Le mot de passe doit faire au moins 8 caractères." },
      { status: 400 },
    );
  }
  if (!consent) {
    return NextResponse.json(
      { error: "consentement_requis", message: "Merci d'accepter les conditions pour créer votre compte." },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      {
        error: "email_pris",
        message: "Un compte existe déjà avec cet email. Connectez-vous.",
      },
      { status: 409 },
    );
  }

  const pub = await prisma.tenant.findUnique({ where: { slug: "public" } });
  if (!pub) {
    return NextResponse.json({ error: "tenant_public_absent" }, { status: 500 });
  }

  const user = await prisma.user.create({
    data: {
      email,
      firstName: firstName || null,
      tenantId: pub.id,
      role: "learner",
      passwordHash: await hashPassword(password),
      consentAt: new Date(),
    },
  });

  const token = await createSessionToken({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role as Role,
  });
  await setSessionCookie(token);

  return NextResponse.json({ ok: true, redirect: "/accueil?bienvenue=1" });
}
