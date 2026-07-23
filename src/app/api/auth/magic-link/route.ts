import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createMagicToken } from "@/lib/auth";
import { appBaseUrlFromRequest } from "@/lib/base-url";
import { isEmailConfigured, sendMagicLink } from "@/lib/email";
import { safeNextPath } from "@/lib/safe-redirect";

export const dynamic = "force-dynamic";

// POST /api/auth/magic-link — body { email }
// Crée un lien de connexion. En dev (pas d'email configuré), le lien est renvoyé
// dans la réponse pour pouvoir se connecter sans infra email. En prod : à envoyer
// par email (Resend) — voir 04_RESTE_A_FAIRE.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const planId = body.planId ? String(body.planId) : null;
  const next = safeNextPath(body.next);
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
  const base = await appBaseUrlFromRequest();
  // Report du forfait choisi sur /tarifs : encodé dans l'URL cible du lien
  // magique, lu par /api/auth/callback pour enchaîner sur le checkout Stripe.
  const link =
    `${base}/api/auth/callback?token=${token}` +
    (planId ? `&plan=${encodeURIComponent(planId)}` : "") +
    (next ? `&next=${encodeURIComponent(next)}` : "");

  // eslint-disable-next-line no-console
  console.log(`[magic-link] ${email} -> ${link}`);

  const isDev = process.env.NODE_ENV !== "production";

  // Envoi par email si Resend est configuré.
  if (isEmailConfigured()) {
    try {
      await sendMagicLink(email, link);
    } catch (e) {
      console.error("[magic-link] envoi email échoué", e);
      if (!isDev) {
        return NextResponse.json(
          { error: "envoi_email", message: "L'envoi de l'email a échoué. Réessayez." },
          { status: 502 },
        );
      }
    }
  } else if (!isDev) {
    // En prod sans email configuré : impossible de se connecter.
    return NextResponse.json(
      { error: "email_non_configure", message: "L'envoi d'emails n'est pas configuré." },
      { status: 503 },
    );
  }

  // En dev, on renvoie le lien direct (pratique, pas besoin d'email).
  return NextResponse.json({ sent: true, devLink: isDev ? link : undefined });
}
