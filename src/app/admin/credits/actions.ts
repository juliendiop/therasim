"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { setConfig } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { grant } from "@/lib/credits";

// Enregistre les réglages de crédits (quotas + coûts) dans app_config.
export async function saveCreditSettings(formData: FormData) {
  await requireSuperAdmin();
  const fields: [string, string][] = [
    ["credits.welcome", "welcome"],
    ["credits.monthly", "monthly"],
    ["credits.cost.miniscene", "costMiniscene"],
    ["credits.cost.simulation", "costSimulation"],
  ];
  for (const [cfgKey, field] of fields) {
    const n = parseInt(String(formData.get(field) ?? "").trim(), 10);
    if (Number.isFinite(n) && n >= 0) await setConfig(cfgKey, String(n));
  }
  revalidatePath("/admin/credits");
}

export type GrantResult = { ok: boolean; message: string };

// Octroi manuel de crédits à un utilisateur (par email).
export async function grantCredits(
  _prev: GrantResult | null,
  formData: FormData,
): Promise<GrantResult> {
  await requireSuperAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const amount = parseInt(String(formData.get("amount") ?? ""), 10);
  if (!email.includes("@")) return { ok: false, message: "Email invalide." };
  if (!Number.isFinite(amount) || amount < 1) {
    return { ok: false, message: "Indiquez un montant d'au moins 1 crédit." };
  }
  const u = await prisma.user.findUnique({ where: { email } });
  if (!u) return { ok: false, message: "Aucun compte avec cet email." };

  const newBalance = await grant(u.id, amount, "admin_grant");
  revalidatePath("/admin/credits");
  return {
    ok: true,
    message: `+${amount} crédits accordés à ${email}. Nouveau solde : ${newBalance}.`,
  };
}
