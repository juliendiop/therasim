// Logique métier des paiements Stripe : création des sessions Checkout/Portail,
// et traitement des événements webhook. Toute écriture de crédits passe par
// grant() (src/lib/credits.ts) — source de vérité unique du portefeuille.
import "server-only";
import type Stripe from "stripe";
import { prisma } from "./prisma";
import { getConfig } from "./config";
import { grant, syncSubscriptionCredits, topUpPlanCredits, zeroPlanCredits } from "./credits";
import { CREDIT_PACKS } from "./credits";
import { isSubscriptionEntitled } from "./entitlements";
import { periodIndexFor } from "./billing-period";
import { BETA_PLAN_LABEL } from "./beta-constants";
import { sendBetaTrialEnd } from "./email";
import { ensureStripeCustomer, stripeClient } from "./stripe";
import { recordFunnelOncePerUser } from "./funnel";
import { recordCommissionsForInvoice, creditCommission } from "./affiliation";

// --- Création des sessions (checkout / portail) ----------------------------

/** Session de paiement UNIQUE pour un pack de crédits. Renvoie l'URL Stripe. */
export async function createCreditsCheckout(
  userId: string,
  packId: string,
  baseUrl: string,
): Promise<string> {
  const pack = CREDIT_PACKS.find((p) => p.id === packId);
  if (!pack) throw new Error("pack de crédits inconnu");
  const priceId = await getConfig(`stripe.price.pack.${packId}`);
  if (!priceId) {
    throw new Error(
      "Ce pack n'a pas encore de Price ID Stripe configuré (voir /admin/facturation).",
    );
  }

  const customerId = await ensureStripeCustomer(userId);
  const session = await stripeClient().checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/credits?success=pack`,
    cancel_url: `${baseUrl}/credits?canceled=1`,
    metadata: { userId, packId, credits: String(pack.credits) },
  });
  if (!session.url) throw new Error("Stripe n'a pas renvoyé d'URL de paiement.");
  return session.url;
}

/** Session de paiement RÉCURRENTE pour un forfait d'abonnement. Renvoie l'URL Stripe. */
export async function createSubscriptionCheckout(
  userId: string,
  planId: string,
  baseUrl: string,
): Promise<string> {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan || !plan.active) throw new Error("forfait inconnu ou inactif");
  if (!plan.stripePriceId) {
    throw new Error(
      "Ce forfait n'a pas encore de Price ID Stripe configuré (voir /admin/facturation).",
    );
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("utilisateur introuvable");

  const customerId = await ensureStripeCustomer(userId);
  const session = await stripeClient().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${baseUrl}/credits?success=plan`,
    cancel_url: `${baseUrl}/credits?canceled=1`,
    metadata: { userId, planId },
    subscription_data: { metadata: { userId, planId, tenantId: user.tenantId } },
  });
  if (!session.url) throw new Error("Stripe n'a pas renvoyé d'URL de paiement.");
  return session.url;
}

/** Session de paiement UNIQUE pour débloquer un référentiel à vie. Renvoie l'URL Stripe. */
export async function createFrameworkCheckout(
  userId: string,
  frameworkId: string,
  baseUrl: string,
): Promise<string> {
  const offer = await prisma.frameworkOffer.findUnique({ where: { frameworkId } });
  if (!offer || !offer.active) throw new Error("Ce référentiel n'est pas en vente à l'unité.");
  if (!offer.stripePriceId) {
    throw new Error(
      "Ce référentiel n'a pas encore de Price ID Stripe configuré (voir /admin/facturation).",
    );
  }

  const customerId = await ensureStripeCustomer(userId);
  const session = await stripeClient().checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [{ price: offer.stripePriceId, quantity: 1 }],
    success_url: `${baseUrl}/f/${frameworkId}?success=framework`,
    cancel_url: `${baseUrl}/f/${frameworkId}?canceled=1`,
    metadata: { type: "framework", userId, frameworkId },
  });
  if (!session.url) throw new Error("Stripe n'a pas renvoyé d'URL de paiement.");
  return session.url;
}

/** Portail Stripe (résiliation, moyen de paiement) pour un abonné existant. */
export async function createBillingPortalSession(
  userId: string,
  baseUrl: string,
): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.stripeCustomerId) throw new Error("aucun abonnement Stripe pour cet utilisateur");
  const portal = await stripeClient().billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${baseUrl}/credits`,
  });
  return portal.url;
}

// --- Traitement des événements webhook --------------------------------------

/** Date de fin de période courante — le champ a migré du niveau Subscription
 *  vers les SubscriptionItem dans les API Stripe récentes ; on gère les deux. */
function subscriptionPeriodEnd(sub: Stripe.Subscription): Date | null {
  const legacy = (sub as unknown as { current_period_end?: number }).current_period_end;
  if (typeof legacy === "number") return new Date(legacy * 1000);
  const itemEnd = sub.items?.data?.[0]?.current_period_end;
  if (typeof itemEnd === "number") return new Date(itemEnd * 1000);
  return null;
}

async function upsertUserSubscription(
  userId: string,
  tenantId: string,
  planId: string,
  sub: Stripe.Subscription,
): Promise<void> {
  const data = {
    planId,
    stripeSubscriptionId: sub.id,
    status: sub.status,
    currentPeriodEnd: subscriptionPeriodEnd(sub),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  };
  await prisma.userSubscription.upsert({
    where: { userId },
    update: data,
    create: { userId, tenantId, ...data },
  });
}

/**
 * `checkout.session.completed` :
 * - mode "payment" (pack) -> accorde les crédits immédiatement.
 * - mode "subscription" -> crée/màj l'abonnement local SANS accorder de crédits
 *   (les crédits sont accordés sur `invoice.paid`, pour éviter un double octroi
 *   au premier paiement — Stripe émet aussi une facture pour la 1ère période).
 */
export async function handleCheckoutCompleted(event: Stripe.Event): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;
  const userId = session.metadata?.userId;
  if (!userId) return;

  if (session.mode === "payment") {
    // Déblocage d'un référentiel à l'unité (accès à vie).
    if (session.metadata?.type === "framework" && session.metadata.frameworkId) {
      await prisma.userFrameworkAccess.upsert({
        where: {
          userId_frameworkId: { userId, frameworkId: session.metadata.frameworkId },
        },
        update: {},
        create: { userId, frameworkId: session.metadata.frameworkId, source: "purchase" },
      });
      // Mesure d'entonnoir : 1er paiement de ce visiteur (achat à l'unité).
      await recordFunnelOncePerUser("purchase", userId, { meta: { kind: "framework" } });
      return;
    }
    // Pack de crédits.
    const credits = Number(session.metadata?.credits ?? 0);
    if (credits > 0) {
      await grant(userId, credits, "purchase", {
        sessionId: session.id,
        packId: session.metadata?.packId,
      });
      await recordFunnelOncePerUser("purchase", userId, { meta: { kind: "pack" } });
    }
    return;
  }

  if (session.mode === "subscription") {
    const planId = session.metadata?.planId;
    const subscriptionId =
      typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
    if (!planId || !subscriptionId) return;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;
    const sub = await stripeClient().subscriptions.retrieve(subscriptionId);
    await upsertUserSubscription(userId, user.tenantId, planId, sub);
    // Mesure d'entonnoir : 1er paiement de ce visiteur (abonnement).
    await recordFunnelOncePerUser("purchase", userId, { meta: { kind: "plan", planId } });
  }
}

/** `invoice.paid` : seul déclencheur d'octroi de crédits pour un abonnement
 *  (couvre à la fois le 1er paiement et chaque renouvellement mensuel). */
export async function handleInvoicePaid(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  // Champ déplacé dans les API Stripe récentes : invoice.subscription -> invoice.parent.subscription_details.subscription.
  const rawSub = invoice.parent?.subscription_details?.subscription;
  const subscriptionId = typeof rawSub === "string" ? rawSub : rawSub?.id;
  if (!subscriptionId) return; // facture hors abonnement (ne devrait pas arriver ici)

  let userSub = await prisma.userSubscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
  });

  // Repli défensif : l'événement invoice.paid arrive avant que checkout.session.completed
  // n'ait créé l'enregistrement local (ordre non garanti par Stripe).
  if (!userSub) {
    const sub = await stripeClient().subscriptions.retrieve(subscriptionId);
    const userId = sub.metadata?.userId;
    const planId = sub.metadata?.planId;
    const tenantId = sub.metadata?.tenantId;
    if (!userId || !planId || !tenantId) return;
    await upsertUserSubscription(userId, tenantId, planId, sub);
    userSub = await prisma.userSubscription.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
    });
    if (!userSub) return;
  }

  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: userSub.planId } });
  // NB : on ne sort PAS pour un forfait « sans compter » (monthlyCredits null) ni sans
  // crédits — `syncSubscriptionCredits` gère ces cas (planCredits à 0), et surtout les
  // commissions d'affiliation plus bas doivent s'exécuter pour tout paiement encaissé.
  if (!plan) return;

  // Ancre de facturation : requise pour un periodIndex déterministe. Les abonnements
  // antérieurs à la bêta n'en ont pas -> on la rétablit depuis Stripe, une fois.
  await ensurePeriodAnchor(userSub.stripeSubscriptionId, userSub.periodAnchorAt);

  // Période FACTURÉE (et non « maintenant ») : c'est elle qui identifie l'allocation.
  const lineStart = invoice.lines?.data?.[0]?.period?.start;
  const periodDate = typeof lineStart === "number" ? new Date(lineStart * 1000) : new Date();

  // Réinitialise l'allocation de forfait pour la période facturée (non cumulatif).
  // Idempotence structurelle : un rejeu de l'événement, ou la synchro paresseuse
  // ayant déjà servi cette période, deviennent des no-op.
  await syncSubscriptionCredits(userSub.userId, periodDate);

  // Affiliation : commission niveau 1/2 sur ce paiement d'abonnement encaissé
  // (1er paiement ET chaque renouvellement -> commission "à vie"). Best-effort :
  // ne doit jamais faire échouer le traitement du webhook.
  await recordCommissionsForInvoice({
    payingUserId: userSub.userId,
    invoiceId: invoice.id,
    amountPaidCents: invoice.amount_paid,
  });

  // Rafraîchit la période courante à partir de l'objet Subscription à jour.
  const sub = await stripeClient().subscriptions.retrieve(subscriptionId);
  await prisma.userSubscription.update({
    where: { stripeSubscriptionId: subscriptionId },
    data: {
      status: sub.status,
      currentPeriodEnd: subscriptionPeriodEnd(sub),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
  });
}

/** `charge.refunded` : reprend (clawback) les commissions d'affiliation liées
 *  à la facture remboursée. Best-effort, ne doit jamais faire échouer le webhook.
 *
 *  Dérive Stripe : dans cette version du SDK (stripe@22.3.0), ni `Charge.invoice`
 *  ni `Invoice.payment_intent`/`charge` n'existent plus dans les types (vérifié
 *  par lecture directe de node_modules/stripe/cjs/resources/{Charges,Invoices,
 *  PaymentIntents}.d.ts). On tente un repli défensif sur les champs legacy qui
 *  peuvent encore être présents dans la charge utile JSON réelle même si absents
 *  des types. Si la facture reste introuvable, on documente le trou plutôt que
 *  de l'ignorer silencieusement (aucun clawback n'est alors effectué -> à traiter
 *  manuellement via /admin/affiliation, ajustement manuel). */
export async function handleChargeRefunded(event: Stripe.Event): Promise<void> {
  try {
    const charge = event.data.object as Stripe.Charge;

    // Repli défensif : champ legacy, non typé dans cette version du SDK.
    const legacyInvoice = (charge as unknown as { invoice?: string | { id: string } | null })
      .invoice;
    let invoiceId =
      typeof legacyInvoice === "string" ? legacyInvoice : legacyInvoice?.id ?? null;

    if (!invoiceId && charge.payment_intent) {
      const paymentIntentId =
        typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent.id;
      const pi = await stripeClient().paymentIntents.retrieve(paymentIntentId);
      const legacyPiInvoice = (pi as unknown as { invoice?: string | { id: string } | null }).invoice;
      invoiceId = typeof legacyPiInvoice === "string" ? legacyPiInvoice : legacyPiInvoice?.id ?? null;
    }

    if (!invoiceId) {
      // TODO(affiliation) : trou d'API Stripe documenté — impossible de relier ce
      // remboursement à une facture avec cette version du SDK. Clawback à faire
      // manuellement si nécessaire (voir /admin/affiliation).
      console.warn(
        "[affiliation] clawback ignoré : impossible de résoudre l'invoice depuis charge.refunded",
        charge.id,
      );
      return;
    }

    const rows = await prisma.commissionLedger.findMany({
      where: { stripeInvoiceId: invoiceId, reason: { in: ["commission_sub_t1", "commission_sub_t2"] } },
    });
    const refundRatio =
      charge.amount > 0 ? Math.min(1, charge.amount_refunded / charge.amount) : 0;
    if (refundRatio <= 0) return;

    for (const row of rows) {
      const clawbackCents = -Math.round(row.delta * refundRatio);
      await creditCommission(row.beneficiaryId, clawbackCents, {
        reason: "clawback",
        tier: row.tier ?? undefined,
        sourceUserId: row.sourceUserId ?? undefined,
        stripeInvoiceId: `${invoiceId}:refund:${charge.id}`,
        meta: { originalLedgerId: row.id, refundRatio },
      });
    }
  } catch (e) {
    console.error("[affiliation] échec clawback charge.refunded", e);
  }
}

// --- Résolution du forfait ---------------------------------------------------

/** Price ID du 1er article de l'abonnement. */
function subscriptionPriceId(sub: Stripe.Subscription): string | null {
  return sub.items?.data?.[0]?.price?.id ?? null;
}

/**
 * Forfait local correspondant à un abonnement Stripe.
 *
 * `metadata.planId` d'abord (posé par le Checkout et par la réclamation bêta), sinon
 * résolution par Price ID — INDISPENSABLE : un changement de forfait fait depuis le
 * portail Stripe ne met PAS à jour les metadata. Sans ce repli, `planId` restait
 * éternellement figé sur l'ancien forfait (bug préexistant).
 */
async function resolvePlanForSubscription(sub: Stripe.Subscription) {
  const metaPlanId = sub.metadata?.planId;
  if (metaPlanId) {
    const byMeta = await prisma.subscriptionPlan.findUnique({ where: { id: metaPlanId } });
    if (byMeta) return byMeta;
  }
  const priceId = subscriptionPriceId(sub);
  if (!priceId) return null;
  return prisma.subscriptionPlan.findFirst({ where: { stripePriceId: priceId } });
}

/** Utilisateur rattaché à un abonnement : metadata, sinon Customer Stripe. */
async function resolveUserForSubscription(sub: Stripe.Subscription) {
  const userId = sub.metadata?.userId;
  if (userId) {
    const byMeta = await prisma.user.findUnique({ where: { id: userId } });
    if (byMeta) return byMeta;
  }
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!customerId) return null;
  return prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
}

/** Ancre de facturation, rétablie depuis Stripe si absente localement. */
async function ensurePeriodAnchor(
  stripeSubscriptionId: string,
  current: Date | null,
): Promise<Date> {
  if (current) return current;
  const sub = await stripeClient().subscriptions.retrieve(stripeSubscriptionId);
  const anchor = new Date(sub.start_date * 1000);
  await prisma.userSubscription
    .update({ where: { stripeSubscriptionId }, data: { periodAnchorAt: anchor } })
    .catch(() => {});
  return anchor;
}

/**
 * `customer.subscription.created` : indispensable pour les abonnements créés par API
 * (bêta) et non par Checkout — sans ce handler, aucune ligne locale n'existerait.
 * Crée l'état local ET crédite l'allocation de la première période, y compris en
 * `trialing` où AUCUNE facture n'est émise.
 */
export async function handleSubscriptionCreated(event: Stripe.Event): Promise<void> {
  const sub = event.data.object as Stripe.Subscription;
  const [user, plan] = await Promise.all([
    resolveUserForSubscription(sub),
    resolvePlanForSubscription(sub),
  ]);
  if (!user || !plan) {
    console.warn("[billing] subscription.created non rattachable", sub.id);
    return;
  }

  const anchor = new Date(sub.start_date * 1000);
  const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000) : null;

  await prisma.userSubscription.upsert({
    where: { userId: user.id },
    update: {
      tenantId: user.tenantId,
      planId: plan.id,
      stripeSubscriptionId: sub.id,
      status: sub.status,
      currentPeriodEnd: subscriptionPeriodEnd(sub),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      periodAnchorAt: anchor,
      trialEndsAt: trialEnd,
    },
    create: {
      userId: user.id,
      tenantId: user.tenantId,
      planId: plan.id,
      stripeSubscriptionId: sub.id,
      status: sub.status,
      currentPeriodEnd: subscriptionPeriodEnd(sub),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      periodAnchorAt: anchor,
      trialEndsAt: trialEnd,
    },
  });

  // Alloue les crédits de la période courante (essai `trialing` inclus, où aucune
  // facture n'est émise). Non cumulatif : SET à l'allocation du forfait.
  await syncSubscriptionCredits(user.id);
}

/**
 * `customer.subscription.updated` : statut (trialing -> active/canceled), période,
 * résiliation programmée, ET changement de forfait.
 */
export async function handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
  const sub = event.data.object as Stripe.Subscription;
  const local = await prisma.userSubscription.findUnique({
    where: { stripeSubscriptionId: sub.id },
  });

  // Aucun enregistrement local : abonnement créé hors Checkout dont l'événement
  // `created` a été manqué. On le traite comme une création plutôt que de l'ignorer
  // silencieusement, comme le faisait le `.catch(() => {})` précédent.
  if (!local) {
    await handleSubscriptionCreated(event);
    return;
  }

  const newPlan = await resolvePlanForSubscription(sub);
  const anchor = local.periodAnchorAt ?? new Date(sub.start_date * 1000);

  await prisma.userSubscription.update({
    where: { stripeSubscriptionId: sub.id },
    data: {
      status: sub.status,
      currentPeriodEnd: subscriptionPeriodEnd(sub),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      periodAnchorAt: anchor,
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      ...(newPlan ? { planId: newPlan.id } : {}),
    },
  });

  if (!isSubscriptionEntitled(sub.status)) {
    // Statut devenu non entitled (canceled/incomplete_expired…) : fin d'accès,
    // l'allocation de forfait tombe à 0. Le portefeuille acheté reste intact.
    await zeroPlanCredits(local.userId);
  } else if (newPlan && newPlan.id !== local.planId) {
    // Changement de forfait EN COURS de cycle.
    if (newPlan.monthlyCredits == null) {
      // Passage à un forfait « sans compter » : plus de décompte, planCredits remis à 0
      // (le débit est court-circuité pour ces forfaits).
      await zeroPlanCredits(local.userId);
    } else {
      // L'allocation de la période courante a déjà été (ré)initialisée ; on ajoute
      // seulement le différentiel — sinon un abonné qui monte en gamme paierait sans
      // rien recevoir avant le cycle suivant. Un ancien forfait « sans compter » compte
      // pour 0 (on n'enlève rien de la période en cours).
      const oldPlan = await prisma.subscriptionPlan.findUnique({ where: { id: local.planId } });
      const diff = newPlan.monthlyCredits - (oldPlan?.monthlyCredits ?? 0);
      if (diff > 0) {
        await topUpPlanCredits({
          userId: local.userId,
          amount: diff,
          stripeSubscriptionId: sub.id,
          periodIndex: periodIndexFor(anchor, new Date()),
          meta: { from: oldPlan?.key ?? local.planId, to: newPlan.key, diff },
        });
      }
    }
  } else {
    // Mise à jour ordinaire (statut/période) : (ré)alloue la période courante au besoin.
    await syncSubscriptionCredits(local.userId);
  }
}

/**
 * `customer.subscription.trial_will_end` : émis par Stripe 3 jours avant la fin.
 * Envoie l'email de fin d'essai, une seule fois (marqueur en base : Stripe rejoue).
 */
export async function handleTrialWillEnd(event: Stripe.Event): Promise<void> {
  const sub = event.data.object as Stripe.Subscription;
  const local = await prisma.userSubscription.findUnique({
    where: { stripeSubscriptionId: sub.id },
  });
  if (!local || local.trialEndEmailAt) return; // déjà envoyé

  const user = await prisma.user.findUnique({ where: { id: local.userId } });
  if (!user) return;
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: local.planId } });
  const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000) : local.trialEndsAt;

  // Marqueur posé AVANT l'envoi : en cas de rejeu concurrent, on préfère un email
  // manquant à un email envoyé deux fois.
  await prisma.userSubscription.update({
    where: { stripeSubscriptionId: sub.id },
    data: { trialEndEmailAt: new Date() },
  });

  try {
    await sendBetaTrialEnd(user.email, {
      firstName: user.firstName,
      planLabel: plan?.label ?? BETA_PLAN_LABEL,
      endsAt: trialEnd,
      couponCode: process.env.BETA_CONVERSION_COUPON || null,
    });
  } catch (e) {
    console.error("[billing] email de fin d'essai non envoyé", user.email, e);
  }
}

/** `customer.subscription.deleted` : abonnement résilié/expiré, accès révoqué. */
export async function handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
  const sub = event.data.object as Stripe.Subscription;
  const local = await prisma.userSubscription
    .update({
      where: { stripeSubscriptionId: sub.id },
      data: { status: "canceled" },
    })
    .catch(() => null);

  if (!local) return; // déjà absent localement

  // Fin d'accès : l'allocation de forfait tombe à 0 (le reliquat non consommé est
  // perdu). Le portefeuille `credits` (packs achetés + gratuits) reste intact.
  await zeroPlanCredits(local.userId);

  // `isBetaTester` est conservé volontairement : c'est un marqueur HISTORIQUE, utile
  // pour segmenter les stats et les relances. L'accès, lui, est déjà révoqué par le
  // statut `canceled` (isSubscriptionEntitled renvoie false).
  const user = await prisma.user.findUnique({ where: { id: local.userId } });
  if (user?.isBetaTester) {
    console.log(`[beta] fin d'accès bêta · ${user.email} · cohorte ${user.betaCohort ?? "?"}`);
  }
}
