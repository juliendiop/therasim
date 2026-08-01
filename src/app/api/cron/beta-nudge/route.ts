import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appBaseUrlFromRequest } from "@/lib/base-url";
import { isEmailConfigured, sendBetaNudge } from "@/lib/email";
import { betaConfig } from "@/lib/beta-config";
import { claimBetaEmailDay } from "@/lib/beta-email-gate";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/beta-nudge — exécution quotidienne (voir `crons` dans vercel.json).
 *
 * Relance J+2 : cible les invitations envoyées il y a au moins 48 h dont le destinataire
 * n'a lancé AUCUN exercice — qu'il ait activé son accès ou non. Le contenu s'adapte :
 * activé -> lien vers son espace + date de fin d'essai ; pas encore activé -> lien
 * d'activation + date d'expiration de l'invitation.
 *
 * Le marqueur `nudgeEmailAt` est posé AVANT toute décision : chaque invitation est
 * traitée UNE fois (envoi, ou non-envoi si une activité est détectée), jamais deux.
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

  const now = new Date();
  const nudgeHours = await betaConfig.nudgeHours();
  const cutoff = new Date(now.getTime() - nudgeHours * 60 * 60 * 1000);
  const baseUrl = await appBaseUrlFromRequest();

  const candidates = await prisma.betaInvite.findMany({
    where: {
      // Invitation réellement envoyée il y a ≥ N h, et jamais encore traitée par ce cron.
      emailSentAt: { not: null, lte: cutoff },
      nudgeEmailAt: null,
      email: { not: null },
      // On relance les invités en attente ou activés ; jamais un code révoqué/expiré.
      status: { in: ["PENDING", "CLAIMED"] },
    },
    take: 200,
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let deferred = 0;

  // Pose le marqueur « traité » (pas de ré-examen ultérieur), sans envoyer.
  const markProcessed = (id: string) =>
    prisma.betaInvite.update({ where: { id }, data: { nudgeEmailAt: new Date() } });

  for (const invite of candidates) {
    if (!invite.email) continue;

    const activated = Boolean(invite.claimedByUserId);
    let firstName = invite.note ?? null;
    let deadline: Date | null = invite.expiresAt;
    let ctaUrl = `${baseUrl}/beta/${invite.code}`;

    if (activated) {
      const userId = invite.claimedByUserId!;
      // Activité = au moins un exercice enregistré. Si oui, pas de relance (traité).
      const attempts = await prisma.attempt.count({ where: { userId } });
      if (attempts > 0) {
        await markProcessed(invite.id);
        skipped++;
        continue;
      }
      // Anti-collision (destinataire activé, donc avec un compte) : si un email bêta est
      // déjà parti aujourd'hui, on REPORTE au lendemain — sans poser nudgeEmailAt, pour
      // que le cron du lendemain réessaie (report, jamais suppression).
      if (!(await claimBetaEmailDay(userId))) {
        deferred++;
        continue;
      }
      const [user, sub] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId } }),
        prisma.userSubscription.findUnique({ where: { userId } }),
      ]);
      firstName = user?.firstName ?? invite.note ?? null;
      deadline = sub?.trialEndsAt ?? invite.expiresAt;
      ctaUrl = `${baseUrl}/accueil`;
    } else if (invite.expiresAt.getTime() <= now.getTime()) {
      // Invitation expirée et jamais activée : inutile de relancer (traité).
      await markProcessed(invite.id);
      skipped++;
      continue;
    }

    // Envoi : on pose le marqueur puis on envoie. (Les invités non activés n'ont pas de
    // compte et ne reçoivent que ce cron : aucune collision possible, aucune porte.)
    await markProcessed(invite.id);
    try {
      await sendBetaNudge(invite.email, { firstName, ctaUrl, deadline, activated });
      sent++;
    } catch (e) {
      failed++;
      console.error("[cron] relance J+2 non envoyée", invite.email, e);
    }
  }

  return NextResponse.json({ ok: true, candidates: candidates.length, sent, skipped, deferred, failed });
}
