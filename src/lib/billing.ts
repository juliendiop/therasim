// Logique métier des paiements Stripe : création des sessions Checkout/Portail,
// et traitement des événements webhook. Toute écriture de crédits passe par
// grant() (src/lib/credits.ts) — source de vérité unique du portefeuille.
import "server-only";
import type Stripe from "stripe";
import { prisma } from "./prisma";
import { getConfig } from "./config";
import { grant } from "./credits";
import { CREDIT_PACKS } from "./credits";
import { ensureStripeCustomer, stripeClient } from "./stripe";
import { recordFunnelOncePerUser } from "./funnel";

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
  if (!plan || plan.monthlyCredits <= 0) return;

  await grant(userSub.userId, plan.monthlyCredits, "subscription_renewal", {
    invoiceId: invoice.id,
    planId: plan.id,
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

/** `customer.subscription.updated` : synchronise statut/période/résiliation programmée. */
export async function handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
  const sub = event.data.object as Stripe.Subscription;
  await prisma.userSubscription
    .update({
      where: { stripeSubscriptionId: sub.id },
      data: {
        status: sub.status,
        currentPeriodEnd: subscriptionPeriodEnd(sub),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      },
    })
    .catch(() => {
      // Pas encore d'enregistrement local (ex. abonnement créé hors Checkout) : rien à faire.
    });
}

/** `customer.subscription.deleted` : abonnement résilié/expiré. */
export async function handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
  const sub = event.data.object as Stripe.Subscription;
  await prisma.userSubscription
    .update({
      where: { stripeSubscriptionId: sub.id },
      data: { status: "canceled" },
    })
    .catch(() => {
      /* déjà absent localement : rien à faire */
    });
}
