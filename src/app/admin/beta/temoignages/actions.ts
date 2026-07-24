"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { publishTestimonial, rejectTestimonial } from "@/lib/beta-bilan";

export async function publishTestimonialAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  if (id) {
    await publishTestimonial(id);
    // La page publique lit les témoignages publiés : on la rafraîchit aussi.
    revalidatePath("/admin/beta/temoignages");
    revalidatePath("/");
  }
}

export async function rejectTestimonialAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  if (id) {
    await rejectTestimonial(id);
    revalidatePath("/admin/beta/temoignages");
    revalidatePath("/");
  }
}
