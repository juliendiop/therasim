"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addMessage, createTicket, getTicket } from "@/lib/support";
import { TICKET_TYPE_LABEL, parseTicketType } from "@/lib/support-types";
import { isEmailConfigured, sendSupportAdminNotice } from "@/lib/email";

export type SupportFormState = { ok: boolean; message: string; ticketId?: string } | null;

/** Destinataire des notifications : le super-admin en base, sinon l'adresse de contact. */
async function adminEmail(): Promise<string> {
  const admin = await prisma.user.findFirst({
    where: { role: "super_admin" },
    select: { email: true },
  });
  return admin?.email ?? "contact@meleta.app";
}

/** Notifie l'admin. Best-effort : un échec d'email ne doit pas perdre le ticket. */
async function notifyAdmin(input: {
  kind: "new" | "reply";
  ticketId: string;
  subject: string;
  typeLabel: string;
  clientEmail: string;
  body: string;
}): Promise<void> {
  if (!isEmailConfigured()) return;
  try {
    await sendSupportAdminNotice(await adminEmail(), input);
  } catch (e) {
    console.error("[support] notification admin non envoyée", input.ticketId, e);
  }
}

/** Ouvre un ticket depuis la modale, sans quitter la page courante. */
export async function createTicketAction(
  _prev: SupportFormState,
  formData: FormData,
): Promise<SupportFormState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Connecte-toi pour envoyer une demande." };

  const type = String(formData.get("type") ?? "");
  const subject = String(formData.get("subject") ?? "");
  const body = String(formData.get("body") ?? "");
  // Page d'origine relevée par le client au moment de l'envoi (contexte technique).
  const page = String(formData.get("page") ?? "") || null;

  const result = await createTicket(
    { id: user.id, tenantId: user.tenantId },
    { type, subject, body, page },
  );
  if (!result.ok) return { ok: false, message: result.message };

  await notifyAdmin({
    kind: "new",
    ticketId: result.ticketId,
    subject: subject.trim(),
    typeLabel: TICKET_TYPE_LABEL[parseTicketType(type)],
    clientEmail: user.email,
    body: body.trim(),
  });

  revalidatePath("/support");
  return { ok: true, message: "Demande envoyée.", ticketId: result.ticketId };
}

/** Répond dans un ticket ouvert (client). */
export async function replyToTicketAction(
  _prev: SupportFormState,
  formData: FormData,
): Promise<SupportFormState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Connecte-toi pour répondre." };

  const ticketId = String(formData.get("ticketId") ?? "");
  const body = String(formData.get("body") ?? "");

  // Cloisonnement : la lecture filtre déjà sur l'utilisateur.
  const ticket = await getTicket(ticketId, user.id);
  if (!ticket) return { ok: false, message: "Demande introuvable." };

  const result = await addMessage(ticketId, { role: "client", id: user.id }, body);
  if (!result.ok) return { ok: false, message: result.message };

  await notifyAdmin({
    kind: "reply",
    ticketId,
    subject: ticket.subject,
    typeLabel: TICKET_TYPE_LABEL[ticket.type],
    clientEmail: user.email,
    body: body.trim(),
  });

  revalidatePath(`/support/${ticketId}`);
  revalidatePath("/support");
  return { ok: true, message: "Message envoyé." };
}
