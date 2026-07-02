import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripeClient } from "@/lib/stripe";
import {
  handleCheckoutCompleted,
  handleInvoicePaid,
  handleSubscriptionDeleted,
  handleSubscriptionUpdated,
} from "@/lib/billing";

export const dynamic = "force-dynamic";

// POST /api/stripe/webhook — reçoit les événements Stripe (paiements, abonnements).
// Corps BRUT requis pour la vérification de signature (jamais req.json() ici).
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe webhook] STRIPE_WEBHOOK_SECRET absente");
    return NextResponse.json({ error: "webhook non configuré" }, { status: 503 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "signature manquante" }, { status: 400 });

  const raw = await req.text();
  let event;
  try {
    event = stripeClient().webhooks.constructEvent(raw, sig, secret);
  } catch (e) {
    console.error("[stripe webhook] signature invalide", e);
    return NextResponse.json({ error: "signature invalide" }, { status: 400 });
  }

  // Idempotence : Stripe garantit "au moins une fois", jamais "exactement une fois".
  // On enregistre l'event AVANT de le traiter ; une violation d'unicité = déjà traité.
  try {
    await prisma.stripeEvent.create({ data: { id: event.id, type: event.type } });
  } catch {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event);
        break;
      case "invoice.paid":
        await handleInvoicePaid(event);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event);
        break;
      default:
        // Événement non géré : on l'ignore silencieusement (déjà marqué traité ci-dessus).
        break;
    }
  } catch (e) {
    console.error(`[stripe webhook] échec traitement ${event.type}`, e);
    // 500 -> Stripe réessaiera automatiquement (l'event, non marqué "réussi" côté Stripe,
    // sera renvoyé ; notre garde d'idempotence empêche seulement le double-traitement
    // d'un event déjà MARQUÉ comme reçu par nous — ici on a échoué, donc on laisse Stripe
    // retenter en supprimant notre marqueur pour ne pas bloquer la relecture).
    await prisma.stripeEvent.delete({ where: { id: event.id } }).catch(() => {});
    return NextResponse.json({ error: "échec du traitement" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
