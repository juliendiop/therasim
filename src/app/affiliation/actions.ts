"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  activateAmbassador,
  createPayoutRequest,
  getActivePayoutRequest,
  markPayoutInvoiceSent,
} from "@/lib/affiliation";

/** Active le statut ambassadeur (CGU acceptées côté formulaire, cf. spec §1.5). */
export async function activateAmbassadorAction(formData: FormData) {
  const user = await requireUser();
  const consent = formData.get("consent");
  if (!consent) redirect("/affiliation?erreur=cgu");
  await activateAmbassador(user.id);
  revalidatePath("/affiliation");
}

export type PayoutActionResult = { ok: boolean; message: string };

/** Crée une demande de paiement pour le solde courant. */
export async function requestPayoutAction(
  _prev: PayoutActionResult | null,
  _formData: FormData,
): Promise<PayoutActionResult> {
  const user = await requireUser();
  const result = await createPayoutRequest(user.id);
  revalidatePath("/affiliation");
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, message: "Demande envoyée. Suivez les instructions ci-dessous pour la facture." };
}

/** Signale que la facture a été envoyée par email pour la demande en cours. */
export async function markInvoiceSentAction(
  _prev: PayoutActionResult | null,
  _formData: FormData,
): Promise<PayoutActionResult> {
  const user = await requireUser();
  const active = await getActivePayoutRequest(user.id);
  if (!active) return { ok: false, message: "Aucune demande en cours." };
  await markPayoutInvoiceSent(active.id, user.id);
  revalidatePath("/affiliation");
  return { ok: true, message: "Merci, votre solde repartira de zéro dès le règlement de la facture." };
}
