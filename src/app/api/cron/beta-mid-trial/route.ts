import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSubscriptionEntitled } from "@/lib/entitlements";
import { isEmailConfigured, sendBetaMidTrial } from "@/lib/email";
import { betaConfig } from "@/lib/beta-config";
import { claimBetaEmailDay } from "@/lib/beta-email-gate";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/beta-mid-trial — exécution quotidienne (voir `crons` dans vercel.json).
 *
 * Cible les essais en cours dont l'ancre a au moins 45 jours et qui n'ont pas encore
 * reçu l'email. Le marqueur `midTrialEmailAt` est posé AVANT l'envoi : en cas de
 * relance du cron, on préfère un email manquant à un doublon.
 */
export async function GET(req: NextRequest) {
  // Vercel Cron envoie `Authorization: Bearer $CRON_SECRET`. Sans secret configuré,
  // la route reste fermée plutôt que publiquement déclenchable.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET non configuré" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  }

  if (!isEmailConfigured()) {
    return NextResponse.json({ error: "email non configuré" }, { status: 503 });
  }

  const midTrialDay = await betaConfig.midTrialDay();
  const cutoff = new Date(Date.now() - midTrialDay * 24 * 60 * 60 * 1000);
  const candidates = await prisma.userSubscription.findMany({
    where: {
      status: "trialing",
      midTrialEmailAt: null,
      periodAnchorAt: { not: null, lte: cutoff },
    },
    take: 200,
  });

  let sent = 0;
  let failed = 0;
  let deferred = 0;

  for (const sub of candidates) {
    // Garde de cohérence : le statut a pu changer entre la requête et l'envoi.
    if (!isSubscriptionEntitled(sub.status)) continue;

    const user = await prisma.user.findUnique({ where: { id: sub.userId } });
    if (!user) continue;

    // Anti-collision : si un email bêta est déjà parti aujourd'hui à ce compte, on REPORTE
    // au lendemain — sans poser midTrialEmailAt, pour que le cron du lendemain réessaie.
    if (!(await claimBetaEmailDay(sub.userId))) {
      deferred++;
      continue;
    }

    await prisma.userSubscription.update({
      where: { id: sub.id },
      data: { midTrialEmailAt: new Date() },
    });

    try {
      await sendBetaMidTrial(user.email, {
        firstName: user.firstName,
        endsAt: sub.trialEndsAt,
      });
      sent++;
    } catch (e) {
      failed++;
      console.error("[cron] email mi-parcours non envoyé", user.email, e);
    }
  }

  return NextResponse.json({ ok: true, candidates: candidates.length, sent, deferred, failed });
}
