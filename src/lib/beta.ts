// Bêta fermée : lecture d'une invitation et réclamation (création de l'abonnement
// d'essai Stripe, 90 jours, sans carte bancaire).
//
// Principes :
// - Le plan est résolu EN BASE par sa `key` (source de vérité unique, administrée
//   dans /admin/facturation). Aucune variable d'environnement ne duplique le Price ID :
//   sinon un changement de prix depuis l'admin laisserait la bêta sur l'ancien.
// - L'unicité d'usage d'un code repose sur un `updateMany` CONDITIONNEL (et non sur
//   un read-then-write), donc la base arbitre les appels concurrents.

import "server-only";
import { prisma } from "./prisma";
import { ensureStripeCustomer, stripeClient } from "./stripe";
import { isSubscriptionEntitled } from "./entitlements";
import { normalizeBetaCode } from "./beta-code";
import { parseBetaInviteStatus, type BetaInviteStatus } from "./beta-status";
import { sendBetaWelcome } from "./email";
import { betaConfig } from "./beta-config";
import { markBetaEmailDay } from "./beta-email-gate";

export type BetaInviteView = {
  id: string;
  code: string;
  cohort: string;
  status: BetaInviteStatus;
  claimedByUserId: string | null;
  expiresAt: Date;
  /** Expiré au sens métier : statut EXPIRED ou date dépassée. */
  isExpired: boolean;
};

/** Lit une invitation par son code (normalisé). Null si inconnue. */
export async function findBetaInvite(rawCode: string): Promise<BetaInviteView | null> {
  const code = normalizeBetaCode(rawCode);
  if (!code) return null;

  const invite = await prisma.betaInvite.findUnique({ where: { code } });
  if (!invite) return null;

  const status = parseBetaInviteStatus(invite.status);
  return {
    id: invite.id,
    code: invite.code,
    cohort: invite.cohort,
    status,
    claimedByUserId: invite.claimedByUserId,
    expiresAt: invite.expiresAt,
    isExpired: status === "EXPIRED" || invite.expiresAt.getTime() <= Date.now(),
  };
}

export type ClaimResult =
  | { ok: true; redirectTo: string }
  | { ok: false; message: string };

/**
 * Réclame une invitation et ouvre l'abonnement d'essai.
 *
 * Ordre volontaire : on VERROUILLE d'abord l'invitation (updateMany conditionnel),
 * ensuite seulement on appelle Stripe. En cas d'échec Stripe on compense en
 * remettant l'invitation en PENDING — préférable à l'inverse, qui laisserait un
 * abonnement Stripe orphelin si l'écriture locale échouait.
 */
export async function claimBetaInvite(
  rawCode: string,
  user: { id: string; tenantId: string; email: string },
): Promise<ClaimResult> {
  const code = normalizeBetaCode(rawCode);
  if (!code) return { ok: false, message: "Code d'invitation invalide." };

  // 1. L'utilisateur est-il déjà servi ? (avant de consommer l'invitation)
  const [existingUser, existingSub] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id } }),
    prisma.userSubscription.findUnique({ where: { userId: user.id } }),
  ]);
  if (!existingUser) return { ok: false, message: "Compte introuvable." };
  if (existingUser.isBetaTester) {
    return { ok: false, message: "Votre accès bêta est déjà actif." };
  }
  if (existingSub && isSubscriptionEntitled(existingSub.status)) {
    return {
      ok: false,
      message:
        "Vous avez déjà un abonnement en cours. Contactez-nous si vous souhaitez basculer sur l'accès bêta.",
    };
  }

  // 2. Le forfait offert doit être configuré (échec explicite plutôt qu'une erreur
  //    Stripe obscure plus loin).
  const planKey = await betaConfig.planKey();
  const plan = await prisma.subscriptionPlan.findUnique({ where: { key: planKey } });
  if (!plan) {
    console.error(`[beta] forfait "${planKey}" introuvable en base`);
    return { ok: false, message: "L'offre bêta n'est pas disponible pour le moment." };
  }
  if (!plan.stripePriceId) {
    console.error(`[beta] forfait "${planKey}" sans stripePriceId (voir /admin/facturation)`);
    return { ok: false, message: "L'offre bêta n'est pas disponible pour le moment." };
  }

  // 3. Verrou atomique : seul le premier appel concurrent obtient count === 1.
  const now = new Date();
  const locked = await prisma.betaInvite.updateMany({
    where: { code, status: "PENDING", expiresAt: { gt: now } },
    data: { status: "CLAIMED", claimedByUserId: user.id, claimedAt: now },
  });
  if (locked.count === 0) {
    return { ok: false, message: "Ce code n'est plus disponible." };
  }

  const invite = await prisma.betaInvite.findUnique({ where: { code } });
  if (!invite) return { ok: false, message: "Ce code n'est plus disponible." };

  try {
    const customerId = await ensureStripeCustomer(user.id);

    // Aucun `default_payment_method` n'est fourni : c'est CE point qui produit
    // l'essai sans carte bancaire. (`payment_method_collection` est un paramètre
    // de Checkout, pas de subscriptions.create — l'ajouter ici serait une erreur.)
    const subscription = await stripeClient().subscriptions.create(
      {
        customer: customerId,
        items: [{ price: plan.stripePriceId }],
        trial_period_days: await betaConfig.trialDays(),
        trial_settings: {
          end_behavior: {
            // Sans carte au terme de l'essai : on annule proprement plutôt que
            // d'émettre une facture impayée. Aucun prélèvement, jamais.
            missing_payment_method: "cancel",
          },
        },
        metadata: {
          betaInviteCode: invite.code,
          betaCohort: invite.cohort,
          userId: user.id,
          // Indispensable : upsertUserSubscription résout le forfait par planId,
          // jamais par Price ID (cf. src/lib/billing.ts).
          planId: plan.id,
        },
      },
      { idempotencyKey: `beta-claim-${invite.id}` },
    );

    const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null;
    const anchor = new Date(subscription.start_date * 1000);

    // 4. État local. Le webhook `customer.subscription.created` fera le même upsert :
    //    on l'écrit ici pour que l'UI soit correcte immédiatement, sans attendre Stripe.
    await prisma.$transaction([
      prisma.userSubscription.upsert({
        where: { userId: user.id },
        update: {
          tenantId: user.tenantId,
          planId: plan.id,
          stripeSubscriptionId: subscription.id,
          status: subscription.status,
          periodAnchorAt: anchor,
          trialEndsAt: trialEnd,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
        create: {
          userId: user.id,
          tenantId: user.tenantId,
          planId: plan.id,
          stripeSubscriptionId: subscription.id,
          status: subscription.status,
          periodAnchorAt: anchor,
          trialEndsAt: trialEnd,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
      }),
      prisma.betaInvite.update({
        where: { id: invite.id },
        data: { stripeSubscriptionId: subscription.id },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { isBetaTester: true, betaCohort: invite.cohort },
      }),
    ]);

    // Bienvenue : best-effort strict. Un échec d'email ne doit pas transformer une
    // activation réussie en erreur affichée au testeur.
    try {
      await sendBetaWelcome(user.email, {
        firstName: existingUser.firstName,
        planLabel: plan.label,
        monthlyCredits: plan.monthlyCredits,
        endsAt: trialEnd,
      });
      // Déclare l'envoi du jour : un cron bêta le même jour se reportera (anti-collision).
      await markBetaEmailDay(user.id);
    } catch (e) {
      console.error("[beta] email de bienvenue non envoyé", user.email, e);
    }

    return { ok: true, redirectTo: "/accueil?beta=1" };
  } catch (e) {
    // Compensation : l'invitation redevient utilisable, sinon un incident Stripe
    // consommerait définitivement le code du testeur.
    await prisma.betaInvite
      .updateMany({
        where: { id: invite.id, status: "CLAIMED", claimedByUserId: user.id },
        data: { status: "PENDING", claimedByUserId: null, claimedAt: null },
      })
      .catch((err) => console.error("[beta] compensation impossible", invite.id, err));

    console.error("[beta] échec de création de l'abonnement d'essai", user.id, e);
    return {
      ok: false,
      message: "L'activation a échoué. Réessayez dans un instant — votre code reste valable.",
    };
  }
}
