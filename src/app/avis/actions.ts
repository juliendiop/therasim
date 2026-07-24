"use server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { submitTestimonial } from "@/lib/beta-bilan";
import type { TestimonialFormState } from "@/lib/testimonial-form-state";

/**
 * Avis laissé librement depuis le site par tout utilisateur connecté. Même circuit
 * que la relance bêta : statut `pending`, publication après validation admin.
 * Distingué par `source: "spontaneous"`.
 */
export async function submitAvisAction(
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
    source: "spontaneous",
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
