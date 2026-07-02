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
  | "password_reset";

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
