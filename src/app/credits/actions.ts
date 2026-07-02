"use server";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { appBaseUrlFromRequest } from "@/lib/base-url";
import { activateSubscriptionChoice, canBuyIndividualOffers } from "@/lib/entitlements";
import {
  createBillingPortalSession,
  createCreditsCheckout,
  createFrameworkCheckout,
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

/** Lance un abonnement Stripe récurrent pour un forfait (site public uniquement). */
export async function checkoutPlanAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  // Membres B2B sans opt-in : leur plateforme leur donne déjà tout son catalogue,
  // un abonnement « domaines au choix » serait trompeur.
  if (!(await canBuyIndividualOffers(user))) {
    redirect(
      `/credits?error=${encodeURIComponent("Les abonnements ne sont pas disponibles sur votre plateforme — elle vous donne déjà accès à son catalogue.")}`,
    );
  }
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

/** Lance un paiement unique pour débloquer un référentiel à vie. */
export async function checkoutFrameworkAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const frameworkId = String(formData.get("frameworkId") ?? "");
  const baseUrl = await appBaseUrlFromRequest();

  let url: string;
  try {
    url = await createFrameworkCheckout(user.id, frameworkId, baseUrl);
  } catch (e) {
    redirect(`/f/${frameworkId}?error=${encodeURIComponent(errorMessage(e))}`);
  }
  redirect(url);
}

/** Consomme un choix du quota d'abonnement pour débloquer un domaine (sans paiement). */
export async function activateFrameworkChoiceAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const frameworkId = String(formData.get("frameworkId") ?? "");

  const result = await activateSubscriptionChoice(user, frameworkId);
  if (!result.ok) {
    redirect(`/f/${frameworkId}?error=${encodeURIComponent(result.message)}`);
  }
  redirect(`/f/${frameworkId}`);
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
