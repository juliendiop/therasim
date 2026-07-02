import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createMagicToken } from "@/lib/auth";
import { appBaseUrl } from "@/lib/base-url";
import { isEmailConfigured, sendPasswordReset } from "@/lib/email";

export const dynamic = "force-dynamic";

// POST /api/auth/forgot-password — body { email }
// Réponse volontairement identique que le compte existe ou non (pas de fuite).
// Réutilise le mécanisme AuthToken (usage unique) avec un TTL de 60 minutes ;
// le lien pointe vers /reset-password, pas vers le callback de connexion.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "email invalide" }, { status: 400 });
  }

  const isDev = process.env.NODE_ENV !== "production";
  const user = await prisma.user.findUnique({ where: { email } });

  // Compte inconnu : même réponse générique, aucun token créé.
  if (!user) return NextResponse.json({ sent: true });

  const token = await createMagicToken(email, user.tenantId, 60);
  const base = appBaseUrl(req.nextUrl.origin);
  const link = `${base}/reset-password?token=${token}`;

  // eslint-disable-next-line no-console
  console.log(`[reset-password] ${email} -> ${link}`);

  if (isEmailConfigured()) {
    try {
      await sendPasswordReset(email, link);
    } catch (e) {
      console.error("[reset-password] envoi email échoué", e);
      if (!isDev) {
        return NextResponse.json(
          { error: "envoi_email", message: "L'envoi de l'email a échoué. Réessayez." },
          { status: 502 },
        );
      }
    }
  } else if (!isDev) {
    return NextResponse.json(
      { error: "email_non_configure", message: "L'envoi d'emails n'est pas configuré." },
      { status: 503 },
    );
  }

  // En dev, on renvoie le lien direct (pas besoin d'infra email).
  return NextResponse.json({ sent: true, devLink: isDev ? link : undefined });
}
