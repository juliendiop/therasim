// Journal d'audit : enregistre les actions non dérivables des autres tables.
// Best-effort : ne jamais faire échouer l'action métier si le log échoue.
import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export type AuditAction =
  | "login"
  | "invite"
  | "role_change"
  | "member_removed"
  | "password_reset"
  // Abonnement (webhook Stripe, src/lib/billing.ts) — non dérivable d'aucune autre
  // table : UserSubscription est un état courant, pas un historique.
  | "subscription_purchase" // checkout.session.completed, mode='subscription'
  | "subscription_created" // customer.subscription.created (couvre aussi la bêta, sans checkout)
  | "subscription_updated" // customer.subscription.updated, SEULEMENT si statut ou forfait change
  | "subscription_canceled" // customer.subscription.deleted
  // Extraction de données personnelles (RGPD) — trace qui/quand/combien/quels filtres.
  | "export_contacts"
  | "export_journal";

export async function logAudit(input: {
  action: AuditAction;
  email: string;
  tenantId?: string | null;
  userId?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        action: input.action,
        email: input.email,
        tenantId: input.tenantId ?? null,
        userId: input.userId ?? null,
        meta: (input.meta ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (e) {
    console.error("[audit] échec enregistrement", e);
  }
}
