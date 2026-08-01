// Anti-collision des emails bêta : deux emails bêta ne partent jamais le même jour
// au même destinataire. Le second est REPORTÉ au lendemain (jamais supprimé) — les
// crons quotidiens (nudge/feedback/mi-parcours/bilan) ne posent pas leur marqueur
// propre quand ils sont reportés, donc le cron du lendemain réessaie.
//
// Traçage : `User.lastBetaEmailAt` porte la date du dernier email bêta envoyé au
// destinataire. C'est aussi la clé de déduplication du report (un seul email/jour).
//
// Clé par UTILISATEUR : les crons feedback/mi-parcours/bilan ne visent que des
// testeurs ACTIVÉS (donc avec un compte) ; la relance J+2 ne passe la porte que
// pour ses destinataires activés (les invités non activés n'ont pas de compte et ne
// reçoivent QUE la relance J+2 — aucune collision possible pour eux).

import "server-only";
import { prisma } from "./prisma";

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Réserve atomiquement le « créneau du jour » pour un destinataire.
 * - `true`  : aucun email bêta n'est encore parti aujourd'hui → l'appelant PEUT envoyer
 *   (la date du jour vient d'être posée).
 * - `false` : un email bêta est déjà parti aujourd'hui → l'appelant REPORTE (il ne pose
 *   pas son marqueur propre ; le cron du lendemain réessaie).
 *
 * L'`updateMany` conditionnel arbitre la course entre deux crons concurrents : un
 * seul obtient `count === 1`.
 */
export async function claimBetaEmailDay(userId: string, now: Date = new Date()): Promise<boolean> {
  const dayStart = startOfUtcDay(now);
  const res = await prisma.user.updateMany({
    where: {
      id: userId,
      OR: [{ lastBetaEmailAt: null }, { lastBetaEmailAt: { lt: dayStart } }],
    },
    data: { lastBetaEmailAt: now },
  });
  return res.count === 1;
}

/**
 * Déclare l'envoi d'un email bêta TRANSACTIONNEL (bienvenue, fin d'essai) : ceux-ci
 * partent toujours (non reportables), mais posent la date du jour pour qu'un cron du
 * même jour se reporte. Best-effort, ne lève jamais.
 */
export async function markBetaEmailDay(userId: string, now: Date = new Date()): Promise<void> {
  await prisma.user
    .update({ where: { id: userId }, data: { lastBetaEmailAt: now } })
    .catch(() => {});
}
