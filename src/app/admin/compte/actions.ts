"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

export type PwResult = { ok: boolean; message: string };

export async function setMyPassword(
  _prev: PwResult | null,
  formData: FormData,
): Promise<PwResult> {
  const user = await requireUser();
  const pw = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (pw.length < 8) return { ok: false, message: "8 caractères minimum." };
  if (pw !== confirm) return { ok: false, message: "Les deux mots de passe diffèrent." };

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(pw) },
  });
  revalidatePath("/admin/compte");
  return { ok: true, message: "Mot de passe enregistré. Vous pouvez l'utiliser pour vous connecter." };
}
