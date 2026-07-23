import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { consumeMagicToken, createSessionToken, setSessionCookie } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { appBaseUrlFromRequest } from "@/lib/base-url";
import { createSubscriptionCheckout } from "@/lib/billing";
import { recordFunnel, peekVisitorId } from "@/lib/funnel";
import { attributeReferralForNewUser } from "@/lib/affiliation";
import { safeNextPath } from "@/lib/safe-redirect";

export const dynamic = "force-dynamic";

// GET /api/auth/callback?token=...&plan=... — valide le lien magique, ouvre
// la session. `plan` (optionnel) : forfait choisi sur /tarifs, reporté via
// /api/auth/magic-link -> enchaîne directement sur le checkout Stripe.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const planId = req.nextUrl.searchParams.get("plan");
  const next = safeNextPath(req.nextUrl.searchParams.get("next"));
  if (!token) return NextResponse.redirect(new URL("/login?erreur=token", req.nextUrl.origin));

  const result = await consumeMagicToken(token);
  if (!result) {
    return NextResponse.redirect(new URL("/login?erreur=expire", req.nextUrl.origin));
  }

  // Trouver ou créer l'utilisateur (apprenant par défaut dans son tenant).
  // On note si le compte est NOUVEAU (pour la mesure d'entonnoir : un lien
  // magique peut aussi bien créer un compte que connecter un compte existant).
  const before = await prisma.user.findUnique({ where: { email: result.email } });
  const user = await prisma.user.upsert({
    where: { email: result.email },
    update: {},
    create: { email: result.email, tenantId: result.tenantId, role: "learner" },
  });
  if (!before) {
    await recordFunnel("signup_complete", { visitorId: await peekVisitorId(), userId: user.id });
    // Affiliation : résout le cookie ts_ref (lien de parrainage) en referredByUserId.
    await attributeReferralForNewUser(user.id);
  }

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

  // Retour explicite demandé (ex. réclamation d'invitation bêta) : prioritaire.
  if (next) return NextResponse.redirect(new URL(next, req.nextUrl.origin));

  // Report du forfait choisi : direct vers le checkout Stripe. Un échec
  // (Price ID manquant, Stripe non configuré) ne doit jamais bloquer la
  // connexion -> repli silencieux sur la destination normale.
  if (planId && user.role !== "super_admin") {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (plan?.active) {
      try {
        const baseUrl = await appBaseUrlFromRequest();
        const url = await createSubscriptionCheckout(user.id, planId, baseUrl);
        return NextResponse.redirect(url);
      } catch {
        // repli ci-dessous
      }
    }
  }

  const dest = user.role === "super_admin" ? "/admin" : "/accueil";
  return NextResponse.redirect(new URL(dest, req.nextUrl.origin));
}
