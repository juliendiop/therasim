"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  createSessionToken,
  getSessionUser,
  requireSuperAdmin,
  setSessionCookie,
  type Role,
} from "@/lib/auth";

// Super-admin : accéder à la plateforme d'un client (impersonation scopée au tenant).
export async function impersonateTenant(formData: FormData) {
  const admin = await requireSuperAdmin();
  const tenantId = String(formData.get("tenantId"));
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) redirect("/admin/tenants");

  const token = await createSessionToken({
    userId: admin.id,
    tenantId,
    role: "super_admin", // on reste super-admin (pour pouvoir revenir), avec le drapeau imp
    imp: true,
  });
  await setSessionCookie(token);
  redirect("/catalogue");
}

// Quitter l'impersonation : revenir à sa propre session (tenant + rôle d'origine).
export async function stopImpersonation() {
  const cur = await getSessionUser();
  if (!cur) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: cur.id } });
  if (!user) redirect("/login");

  const token = await createSessionToken({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role as Role,
    imp: false,
  });
  await setSessionCookie(token);
  redirect("/admin/tenants");
}
