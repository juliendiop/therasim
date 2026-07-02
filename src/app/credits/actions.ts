"use server";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { appBaseUrlFromRequest } from "@/lib/base-url";
import {
  createBillingPortalSession,
  createCreditsCheckout,
  createSubscriptionCheckout,
} from "@/lib/billing";

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Une erreur est survenue.";
}

/** Lance un paiement Stripe unique pour un pack de crédits. */
export async function checkoutPackAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const packId = String(formData.get("packId") ?? "");
  const baseUrl = await appBaseUrlFromRequest();

  let url: string;
  try {
    url = await createCreditsCheckout(user.id, packId, baseUrl);
  } catch (e) {
    redirect(`/credits?error=${encodeURIComponent(errorMessage(e))}`);
  }
  redirect(url);
}

/** Lance un abonnement Stripe récurrent pour un forfait. */
export async function checkoutPlanAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const planId = String(formData.get("planId") ?? "");
  const baseUrl = await appBaseUrlFromRequest();

  let url: string;
  try {
    url = await createSubscriptionCheckout(user.id, planId, baseUrl);
  } catch (e) {
    redirect(`/credits?error=${encodeURIComponent(errorMessage(e))}`);
  }
  redirect(url);
}

/** Ouvre le portail Stripe (résiliation, moyen de paiement) pour un abonné existant. */
export async function manageBillingAction() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const baseUrl = await appBaseUrlFromRequest();

  let url: string;
  try {
    url = await createBillingPortalSession(user.id, baseUrl);
  } catch (e) {
    redirect(`/credits?error=${encodeURIComponent(errorMessage(e))}`);
  }
  redirect(url);
}
