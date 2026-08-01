import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appBaseUrlFromRequest } from "@/lib/base-url";
import { isEmailConfigured, sendBetaBilan } from "@/lib/email";
import { getBetaImprovements } from "@/lib/beta-bilan";
import { BETA_PLAN_LABEL } from "@/lib/beta-constants";
import { betaConfig } from "@/lib/beta-config";
import { claimBetaEmailDay } from "@/lib/beta-email-gate";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/beta-bilan — exécution quotidienne (voir `crons` dans vercel.json).
 *
 * Sollicite le bilan de fin de phase active à J+21 de l'activation. Le paragraphe des
 * améliorations vient de la config admin (masqué si vide). Marqueur `bilanEmailAt` posé
 * à l'envoi (anti-doublon sur relance du cron).
 */
export async function GET(req: NextRequest) {
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

  const now = new Date();
  const bilanDay = await betaConfig.bilanDay();
  const cutoff = new Date(now.getTime() - bilanDay * 24 * 60 * 60 * 1000);
  const baseUrl = await appBaseUrlFromRequest();
  const ctaUrl = `${baseUrl}/beta/bilan`;
  const improvements = await getBetaImprovements();

  const candidates = await prisma.betaInvite.findMany({
    where: {
      status: "CLAIMED",
      claimedByUserId: { not: null },
      bilanEmailAt: null,
      email: { not: null },
      claimedAt: { not: null, lte: cutoff },
    },
    take: 200,
  });

  let sent = 0;
  let failed = 0;
  let deferred = 0;

  for (const invite of candidates) {
    if (!invite.email || !invite.claimedByUserId) continue;
    const userId = invite.claimedByUserId;

    // Anti-collision : si un email bêta est déjà parti aujourd'hui à ce compte, on REPORTE
    // au lendemain — sans poser bilanEmailAt, pour que le cron du lendemain réessaie.
    if (!(await claimBetaEmailDay(userId))) {
      deferred++;
      continue;
    }

    // Marqueur AVANT envoi : un rejeu du cron ne renverra pas l'email.
    await prisma.betaInvite.update({
      where: { id: invite.id },
      data: { bilanEmailAt: new Date() },
    });

    const [user, sub] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.userSubscription.findUnique({ where: { userId } }),
    ]);
    const plan = sub
      ? await prisma.subscriptionPlan.findUnique({ where: { id: sub.planId } })
      : null;

    try {
      await sendBetaBilan(invite.email, {
        firstName: user?.firstName ?? invite.note ?? null,
        planLabel: plan?.label ?? BETA_PLAN_LABEL,
        monthlyCredits: plan?.monthlyCredits ?? null,
        endsAt: sub?.trialEndsAt ?? null,
        improvements,
        ctaUrl,
      });
      sent++;
    } catch (e) {
      failed++;
      console.error("[cron] bilan J+21 non envoyé", invite.email, e);
    }
  }

  return NextResponse.json({ ok: true, candidates: candidates.length, sent, deferred, failed });
}
