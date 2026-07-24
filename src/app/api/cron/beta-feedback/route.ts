import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appBaseUrlFromRequest } from "@/lib/base-url";
import { isEmailConfigured, sendBetaFeedbackRequest } from "@/lib/email";

export const dynamic = "force-dynamic";

/** Mises en situation TERMINÉES qui déclenchent la relance sans attendre J+7. */
const SIM_THRESHOLD = 3;
/** Délai maximal (depuis l'activation) avant de solliciter l'impression à chaud. */
const LATEST_DAY = 7;

/**
 * GET /api/cron/beta-feedback — exécution quotidienne (voir `crons` dans vercel.json).
 *
 * Sollicite l'impression à chaud d'un bêta-testeur ACTIVÉ dès qu'il a terminé 3 mises
 * en situation, ou au plus tard 7 jours après son activation (à condition d'avoir un
 * minimum d'activité — sinon c'est la relance « sans activité » J+2 qui s'applique).
 *
 * Contrairement à la relance J+2, le marqueur `feedbackEmailAt` n'est posé qu'à l'ENVOI
 * effectif : tant que le seuil n'est pas atteint, l'invitation reste candidate.
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
  const latestCutoff = new Date(now.getTime() - LATEST_DAY * 24 * 60 * 60 * 1000);
  const baseUrl = await appBaseUrlFromRequest();
  const ctaUrl = `${baseUrl}/beta/feedback`;

  // Invités activés, jamais encore sollicités pour le feedback.
  const candidates = await prisma.betaInvite.findMany({
    where: {
      status: "CLAIMED",
      claimedByUserId: { not: null },
      feedbackEmailAt: null,
      email: { not: null },
    },
    take: 200,
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const invite of candidates) {
    if (!invite.email || !invite.claimedByUserId) continue;
    const userId = invite.claimedByUserId;

    const simDone = await prisma.simSession.count({
      where: { userId, statut: "terminee" },
    });

    let trigger = simDone >= SIM_THRESHOLD;
    if (!trigger && invite.claimedAt && invite.claimedAt.getTime() <= latestCutoff.getTime()) {
      // Fenêtre J+7 atteinte : on sollicite si un minimum d'activité est enregistré
      // (sinon la relance « sans activité » J+2 est la bonne réponse, pas celle-ci).
      const [attempts, simAny] = await Promise.all([
        prisma.attempt.count({ where: { userId } }),
        prisma.simSession.count({ where: { userId } }),
      ]);
      trigger = attempts > 0 || simAny > 0;
    }

    if (!trigger) {
      skipped++;
      continue;
    }

    // Marqueur AVANT envoi : un rejeu du cron ne renverra pas l'email.
    await prisma.betaInvite.update({
      where: { id: invite.id },
      data: { feedbackEmailAt: new Date() },
    });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    try {
      await sendBetaFeedbackRequest(invite.email, {
        firstName: user?.firstName ?? invite.note ?? null,
        ctaUrl,
      });
      sent++;
    } catch (e) {
      failed++;
      console.error("[cron] relance feedback non envoyée", invite.email, e);
    }
  }

  return NextResponse.json({ ok: true, candidates: candidates.length, sent, skipped, failed });
}
