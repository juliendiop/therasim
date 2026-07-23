"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { claimBetaInvite } from "@/lib/beta";
import { callerIp, rateLimit } from "@/lib/rate-limit";

export type ClaimState = { ok: boolean; message: string } | null;

/**
 * Active l'accès bêta à partir d'un code d'invitation.
 *
 * Le rate limiting porte sur l'IP ET sur l'utilisateur : l'un empêche le balayage
 * de codes depuis une même machine, l'autre le même balayage réparti derrière
 * plusieurs adresses avec un seul compte.
 */
export async function claimBetaInviteAction(
  _prev: ClaimState,
  formData: FormData,
): Promise<ClaimState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Connectez-vous pour activer votre accès." };

  const code = String(formData.get("code") ?? "");
  if (!code) return { ok: false, message: "Code d'invitation manquant." };

  const ip = await callerIp();
  const [byIp, byUser] = await Promise.all([
    rateLimit(`beta-claim:ip:${ip}`, { max: 10, windowMs: 60 * 60 * 1000 }),
    rateLimit(`beta-claim:user:${user.id}`, { max: 10, windowMs: 60 * 60 * 1000 }),
  ]);
  if (!byIp.ok || !byUser.ok) {
    return { ok: false, message: "Trop de tentatives. Réessayez dans une heure." };
  }

  const result = await claimBetaInvite(code, {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
  });
  if (!result.ok) return { ok: false, message: result.message };

  // Le badge de crédits vit dans le LAYOUT racine. Après une Server Action, le
  // `redirect` ci-dessous provoque une navigation côté client : Next ne re-rend que
  // le segment de page, pas le layout, qui resterait affiché avec le solde d'AVANT
  // l'activation. On invalide donc explicitement la racine et tout ce qu'elle porte.
  revalidatePath("/", "layout");

  // `redirect` lève : à laisser hors du bloc try de la logique métier.
  redirect(result.redirectTo);
}
