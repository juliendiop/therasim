import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createSessionToken, setSessionCookie, type Role } from "@/lib/auth";
import { appBaseUrlFromRequest } from "@/lib/base-url";
import { createSubscriptionCheckout } from "@/lib/billing";
import { recordFunnel, peekVisitorId } from "@/lib/funnel";
import { attributeReferralForNewUser } from "@/lib/affiliation";
import { safeNextPath } from "@/lib/safe-redirect";

export const dynamic = "force-dynamic";

// POST /api/auth/register — inscription B2C (site public) avec mot de passe.
// body { firstName?, email, password, consent, planId? }. Crée un apprenant
// dans le tenant public, ouvre la session, puis :
// - planId fourni (venant de /tarifs) -> redirige directement vers le
//   checkout Stripe du forfait choisi ;
// - sinon -> redirige vers l'accueil de bienvenue.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const firstName = String(body.firstName ?? "").trim().slice(0, 60);
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const consent = Boolean(body.consent);
  const planId = body.planId ? String(body.planId) : null;
  // Retour explicite (ex. /beta/CODE). Validé : un `next` externe serait un open redirect.
  const next = safeNextPath(body.next);

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

  // Mesure d'entonnoir : relie le parcours anonyme (cookie visiteur) au compte créé.
  await recordFunnel("signup_complete", { visitorId: await peekVisitorId(), userId: user.id });
  // Affiliation : résout le cookie ts_ref (lien de parrainage) en referredByUserId.
  await attributeReferralForNewUser(user.id);

  // Retour explicite demandé (ex. réclamation d'invitation bêta) : prioritaire sur
  // le report de forfait, les deux ne coexistent pas dans les parcours réels.
  if (next) return NextResponse.json({ ok: true, redirect: next });

  // Report du forfait choisi sur /tarifs : direct vers le checkout Stripe.
  // Un échec (Price ID manquant, Stripe non configuré) ne doit jamais bloquer
  // la création de compte -> repli silencieux sur l'accueil de bienvenue.
  if (planId) {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (plan?.active) {
      try {
        const baseUrl = await appBaseUrlFromRequest();
        const url = await createSubscriptionCheckout(user.id, planId, baseUrl);
        return NextResponse.json({ ok: true, redirect: url });
      } catch {
        // repli ci-dessous
      }
    }
  }

  return NextResponse.json({ ok: true, redirect: "/accueil?bienvenue=1" });
}
