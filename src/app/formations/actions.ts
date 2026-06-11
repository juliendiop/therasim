"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageLive } from "@/lib/roles";
import { createLiveSession, type Pair } from "@/lib/live";

type ModuleItem = { frameworkId: string; competencies: string[] };

async function requireTrainer() {
  const user = await requireUser();
  if (!canManageLive(user.role)) redirect("/catalogue");
  return user;
}

export async function createFormation(formData: FormData) {
  const user = await requireTrainer();
  const titre = String(formData.get("titre") ?? "").trim();
  if (!titre) return;
  const f = await prisma.formation.create({
    data: {
      tenantId: user.tenantId,
      createdBy: user.id,
      titre,
      description: String(formData.get("description") ?? "") || null,
    },
  });
  redirect(`/formations/${f.id}`);
}

export async function deleteFormation(formData: FormData) {
  const user = await requireTrainer();
  const id = String(formData.get("id"));
  const f = await prisma.formation.findUnique({ where: { id } });
  if (f && f.tenantId === user.tenantId) {
    await prisma.formationModule.deleteMany({ where: { formationId: id } });
    await prisma.formation.delete({ where: { id } });
  }
  redirect("/formations");
}

// Ajoute un module : on collecte les compétences cochées (clés `comp:framework:code`),
// groupées par référentiel.
export async function addModule(formData: FormData) {
  const user = await requireTrainer();
  const formationId = String(formData.get("formationId"));
  const formation = await prisma.formation.findUnique({ where: { id: formationId } });
  if (!formation || formation.tenantId !== user.tenantId) redirect("/formations");

  const nom = String(formData.get("nom") ?? "").trim();
  const byFw = new Map<string, string[]>();
  for (const [key] of formData.entries()) {
    if (!key.startsWith("comp:")) continue;
    const [, fw, code] = key.split(":");
    if (!fw || !code) continue;
    const arr = byFw.get(fw) ?? [];
    if (!arr.includes(code)) arr.push(code);
    byFw.set(fw, arr);
  }
  const items: ModuleItem[] = Array.from(byFw, ([frameworkId, competencies]) => ({
    frameworkId,
    competencies,
  }));

  if (!nom || items.length === 0) redirect(`/formations/${formationId}?erreur=incomplet`);

  const count = await prisma.formationModule.count({ where: { formationId } });
  await prisma.formationModule.create({
    data: { formationId, nom, items, ordre: count + 1 },
  });
  revalidatePath(`/formations/${formationId}`);
}

export async function deleteModule(formData: FormData) {
  const user = await requireTrainer();
  const id = String(formData.get("id"));
  const m = await prisma.formationModule.findUnique({ where: { id } });
  if (!m) return;
  const formation = await prisma.formation.findUnique({ where: { id: m.formationId } });
  if (formation && formation.tenantId === user.tenantId) {
    await prisma.formationModule.delete({ where: { id } });
    revalidatePath(`/formations/${m.formationId}`);
  }
}

function itemsToPairs(items: ModuleItem[]): Pair[] {
  const pairs: Pair[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    for (const code of it.competencies) {
      const k = `${it.frameworkId}:${code}`;
      if (!seen.has(k)) {
        seen.add(k);
        pairs.push({ frameworkId: it.frameworkId, code });
      }
    }
  }
  return pairs;
}

// Lance une session live pour un module.
export async function createSessionFromModule(formData: FormData) {
  const user = await requireTrainer();
  const moduleId = String(formData.get("moduleId"));
  const m = await prisma.formationModule.findUnique({ where: { id: moduleId } });
  if (!m) redirect("/formations");
  const formation = await prisma.formation.findUnique({ where: { id: m.formationId } });
  if (!formation || formation.tenantId !== user.tenantId) redirect("/formations");

  const mode = String(formData.get("mode") ?? "evaluation") as "apprentissage" | "evaluation";
  const durationMin = Math.max(1, Math.min(180, Number(formData.get("durationMin") ?? 15)));
  const pairs = itemsToPairs(m.items as ModuleItem[]);

  const session = await createLiveSession({
    tenantId: user.tenantId,
    createdBy: user.id,
    titre: `${formation.titre} — ${m.nom}`,
    pairs,
    mode,
    durationMin,
  });
  redirect(`/sessions/${session.id}`);
}

// Lance une session live pour TOUTE la formation (tous les modules agrégés).
export async function createSessionFromFormation(formData: FormData) {
  const user = await requireTrainer();
  const formationId = String(formData.get("formationId"));
  const formation = await prisma.formation.findUnique({ where: { id: formationId } });
  if (!formation || formation.tenantId !== user.tenantId) redirect("/formations");

  const modules = await prisma.formationModule.findMany({ where: { formationId } });
  const allItems = modules.flatMap((m) => m.items as ModuleItem[]);
  const pairs = itemsToPairs(allItems);
  if (pairs.length === 0) redirect(`/formations/${formationId}`);

  const mode = String(formData.get("mode") ?? "evaluation") as "apprentissage" | "evaluation";
  const durationMin = Math.max(1, Math.min(180, Number(formData.get("durationMin") ?? 20)));

  const session = await createLiveSession({
    tenantId: user.tenantId,
    createdBy: user.id,
    titre: `${formation.titre} — Évaluation complète`,
    pairs,
    mode,
    durationMin,
  });
  redirect(`/sessions/${session.id}`);
}
