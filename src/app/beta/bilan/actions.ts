"use server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { appBaseUrlFromRequest } from "@/lib/base-url";
import { submitBetaBilan } from "@/lib/beta-bilan";
import { isEmailConfigured, sendBetaTestimonialRequest } from "@/lib/email";

export type BilanFormState = { ok: boolean; message?: string } | null;

/**
 * Enregistre le bilan J+21. Si la note est celle d'un promoteur (8-10), déclenche
 * la relance témoignage dans la foulée — une seule fois (marqueur testimonialInviteAt).
 */
export async function submitBilanAction(
  _prev: BilanFormState,
  formData: FormData,
): Promise<BilanFormState> {
  const user = await requireUser();
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { betaCohort: true, firstName: true, email: true, testimonialInviteAt: true },
  });

  const npsRaw = String(formData.get("nps") ?? "");
  const nps = npsRaw === "" ? NaN : Number(npsRaw);

  const res = await submitBetaBilan({
    userId: user.id,
    tenantId: user.tenantId,
    cohort: dbUser?.betaCohort ?? null,
    input: {
      q1: String(formData.get("q1") ?? ""),
      q2: String(formData.get("q2") ?? ""),
      q3: String(formData.get("q3") ?? ""),
      q4: String(formData.get("q4") ?? ""),
      nps,
      npsWhy: String(formData.get("npsWhy") ?? ""),
    },
  });

  if (!res.ok) return { ok: false, message: res.message };

  // Promoteur : sollicite un témoignage, une seule fois, sans jamais faire échouer
  // l'enregistrement du bilan si l'email échoue.
  if (res.promoter && dbUser && !dbUser.testimonialInviteAt && isEmailConfigured()) {
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { testimonialInviteAt: new Date() },
      });
      const baseUrl = await appBaseUrlFromRequest();
      await sendBetaTestimonialRequest(dbUser.email, {
        firstName: dbUser.firstName,
        ctaUrl: `${baseUrl}/beta/temoignage`,
      });
    } catch (e) {
      console.error("[beta] relance témoignage non envoyée", user.id, e);
    }
  }

  return { ok: true };
}
