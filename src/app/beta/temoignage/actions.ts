"use server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { submitTestimonial } from "@/lib/beta-bilan";

export type TestimonialFormState = { ok: boolean; message?: string } | null;

/** Enregistre un témoignage (statut `pending` : rien n'est public avant validation). */
export async function submitTestimonialAction(
  _prev: TestimonialFormState,
  formData: FormData,
): Promise<TestimonialFormState> {
  const user = await requireUser();
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { firstName: true },
  });

  const res = await submitTestimonial({
    userId: user.id,
    tenantId: user.tenantId,
    firstName: dbUser?.firstName ?? null,
    input: {
      before: String(formData.get("before") ?? ""),
      during: String(formData.get("during") ?? ""),
      after: String(formData.get("after") ?? ""),
      displayMode: String(formData.get("displayMode") ?? ""),
      profession: String(formData.get("profession") ?? ""),
    },
  });

  return res.ok ? { ok: true } : { ok: false, message: res.message };
}
