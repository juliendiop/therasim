"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addMessage, getTicket, setTicketStatus } from "@/lib/support";
import { assistOnTicket, type SupportAssist } from "@/lib/support-ai";
import { isEmailConfigured, sendSupportClientReply } from "@/lib/email";

export type AdminReplyState = { ok: boolean; message: string } | null;
export type AssistState = { ok: boolean; message?: string; assist?: SupportAssist } | null;

/**
 * Envoie la réponse à un client. C'est CET envoi explicite qui crée le message,
 * à partir du texte tel que l'administrateur l'a laissé — y compris s'il a
 * entièrement réécrit le projet proposé par l'IA. Rien n'est envoyé automatiquement.
 */
export async function replyAsAdminAction(
  _prev: AdminReplyState,
  formData: FormData,
): Promise<AdminReplyState> {
  const admin = await requireSuperAdmin();
  const ticketId = String(formData.get("ticketId") ?? "");
  const body = String(formData.get("body") ?? "");
  const alsoClose = formData.get("close") === "on";

  const ticket = await getTicket(ticketId);
  if (!ticket) return { ok: false, message: "Demande introuvable." };

  const result = await addMessage(ticketId, { role: "admin", id: admin.id }, body);
  if (!result.ok) return { ok: false, message: result.message };

  if (alsoClose) await setTicketStatus(ticketId, "closed");

  // Notification du client : best-effort, la réponse est déjà enregistrée.
  if (isEmailConfigured()) {
    const client = await prisma.user.findUnique({ where: { id: ticket.userId } });
    if (client) {
      try {
        await sendSupportClientReply(client.email, {
          ticketId,
          subject: ticket.subject,
          body: body.trim(),
          firstName: client.firstName,
        });
      } catch (e) {
        console.error("[support] notification client non envoyée", ticketId, e);
      }
    }
  }

  revalidatePath(`/admin/support/${ticketId}`);
  revalidatePath("/admin/support");
  return { ok: true, message: alsoClose ? "Réponse envoyée, demande close." : "Réponse envoyée." };
}

/** Clôt ou rouvre un ticket. */
export async function toggleTicketStatusAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const ticketId = String(formData.get("ticketId") ?? "");
  const next = String(formData.get("next") ?? "");
  if (next !== "open" && next !== "closed") return;
  await setTicketStatus(ticketId, next);
  revalidatePath(`/admin/support/${ticketId}`);
  revalidatePath("/admin/support");
}

/**
 * Sollicite l'IA sur un ticket. Déclenchée par un clic, jamais automatiquement.
 * La sortie est RENVOYÉE à la page, jamais écrite en base : elle vit dans l'état
 * du composant et disparaît à la navigation.
 */
export async function assistAction(_prev: AssistState, formData: FormData): Promise<AssistState> {
  await requireSuperAdmin();
  const ticketId = String(formData.get("ticketId") ?? "");
  const ticket = await getTicket(ticketId);
  if (!ticket) return { ok: false, message: "Demande introuvable." };

  try {
    const assist = await assistOnTicket({
      type: ticket.type,
      subject: ticket.subject,
      context: ticket.context,
      messages: ticket.messages.map((m) => ({ authorRole: m.authorRole, body: m.body })),
    });
    return { ok: true, assist };
  } catch (e) {
    console.error("[support] assistance IA en échec", ticketId, e);
    return {
      ok: false,
      message:
        "L'IA n'a pas répondu. Vérifie que la clé Mistral est configurée (/admin/modeles).",
    };
  }
}
