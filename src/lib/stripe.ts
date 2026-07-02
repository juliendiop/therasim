// Client Stripe partagé (server-only). Paiements uniques (packs de crédits)
// et abonnements récurrents (forfaits), tous via Checkout hébergé — aucun
// Stripe.js/Elements côté client, cohérent avec le style Server Actions du reste
// de l'app.
import "server-only";
import Stripe from "stripe";
import { prisma } from "./prisma";

export class StripeNotConfiguredError extends Error {
  constructor() {
    super("STRIPE_SECRET_KEY non configurée : les paiements sont indisponibles.");
    this.name = "StripeNotConfiguredError";
  }
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let _client: Stripe | null = null;

export function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeNotConfiguredError();
  if (!_client) _client = new Stripe(key);
  return _client;
}

/** Garantit un Customer Stripe pour cet utilisateur (créé au 1er achat, réutilisé ensuite). */
export async function ensureStripeCustomer(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("utilisateur introuvable");
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripeClient().customers.create({
    email: user.email,
    metadata: { userId: user.id, tenantId: user.tenantId },
  });
  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });
  return customer.id;
}
