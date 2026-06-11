"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function createTenant(formData: FormData) {
  await requireSuperAdmin();
  const nom = String(formData.get("nom") ?? "").trim();
  if (!nom) return;
  const type = String(formData.get("type") ?? "whitelabel");
  let slug = slugify(String(formData.get("slug") ?? "") || nom);
  // Évite la collision de slug.
  if (await prisma.tenant.findUnique({ where: { slug } })) {
    slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  }
  await prisma.tenant.create({ data: { nom, slug, type } });
  revalidatePath("/admin/tenants");
}

export async function updateBranding(formData: FormData) {
  await requireSuperAdmin();
  const tenantId = String(formData.get("tenantId"));
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      brandName: String(formData.get("brandName") ?? "") || null,
      colorPrimary: String(formData.get("colorPrimary") ?? "") || null,
      logoUrl: String(formData.get("logoUrl") ?? "") || null,
      statut: String(formData.get("statut") ?? "actif"),
    },
  });
  revalidatePath(`/admin/tenants/${tenantId}`);
}

export async function createPack(formData: FormData) {
  await requireSuperAdmin();
  const nom = String(formData.get("nom") ?? "").trim();
  if (!nom) return;
  let slug = slugify(String(formData.get("slug") ?? "") || nom);
  if (await prisma.pack.findUnique({ where: { slug } })) {
    slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  }
  await prisma.pack.create({
    data: { nom, slug, description: String(formData.get("description") ?? "") || null },
  });
  revalidatePath("/admin/packs");
}

export async function togglePackFramework(formData: FormData) {
  await requireSuperAdmin();
  const packId = String(formData.get("packId"));
  const frameworkId = String(formData.get("frameworkId"));
  const existing = await prisma.packFramework.findUnique({
    where: { packId_frameworkId: { packId, frameworkId } },
  });
  if (existing) {
    await prisma.packFramework.delete({
      where: { packId_frameworkId: { packId, frameworkId } },
    });
  } else {
    await prisma.packFramework.create({ data: { packId, frameworkId } });
  }
  revalidatePath("/admin/packs");
}

export async function toggleTenantPack(formData: FormData) {
  await requireSuperAdmin();
  const tenantId = String(formData.get("tenantId"));
  const packId = String(formData.get("packId"));
  const existing = await prisma.tenantPack.findUnique({
    where: { tenantId_packId: { tenantId, packId } },
  });
  if (existing) {
    await prisma.tenantPack.delete({
      where: { tenantId_packId: { tenantId, packId } },
    });
  } else {
    await prisma.tenantPack.create({ data: { tenantId, packId } });
  }
  revalidatePath(`/admin/tenants/${tenantId}`);
}

// Ajustement fin : ajoute/retire un référentiel pour un tenant, ou efface l'override.
export async function setFrameworkOverride(formData: FormData) {
  await requireSuperAdmin();
  const tenantId = String(formData.get("tenantId"));
  const frameworkId = String(formData.get("frameworkId"));
  const mode = String(formData.get("mode")); // 'add' | 'remove' | 'none'
  const key = { tenantId_frameworkId: { tenantId, frameworkId } };
  if (mode === "none") {
    await prisma.tenantFrameworkOverride.deleteMany({ where: { tenantId, frameworkId } });
  } else {
    await prisma.tenantFrameworkOverride.upsert({
      where: key,
      update: { mode },
      create: { tenantId, frameworkId, mode },
    });
  }
  revalidatePath(`/admin/tenants/${tenantId}`);
}
