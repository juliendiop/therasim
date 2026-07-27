"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { generateDrillDraft, type DrillDraft } from "@/lib/generate";
import { EvaluatorNotConfiguredError } from "@/lib/evaluator";
import { parseNature, parseTier } from "@/lib/framework";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

// --- Référentiel -----------------------------------------------------------

export async function createReferential(formData: FormData) {
  await requireSuperAdmin();
  const nom = String(formData.get("nom") ?? "").trim();
  if (!nom) return;
  const type = String(formData.get("type") ?? "approche");
  const description = String(formData.get("description") ?? "") || null;

  let fwId = slugify(nom).replace(/_/g, "-");
  if (await prisma.framework.findUnique({ where: { id: fwId } })) {
    fwId = `${fwId}-${Math.random().toString(36).slice(2, 5)}`;
  }
  const gridId = `${fwId}-v1`;
  await prisma.competencyGrid.create({ data: { id: gridId, nom: `${nom} — grille v1` } });
  await prisma.framework.create({
    data: { id: fwId, nom, type, description, gridId, statut: "brouillon" },
  });
  redirect(`/admin/referentiels/${fwId}`);
}

export async function updateReferential(formData: FormData) {
  await requireSuperAdmin();
  const id = String(formData.get("id"));
  await prisma.framework.update({
    where: { id },
    data: {
      nom: String(formData.get("nom") ?? "").trim(),
      type: String(formData.get("type") ?? "approche"),
      description: String(formData.get("description") ?? "") || null,
      nature: parseNature(formData.get("nature")),
      tier: parseTier(formData.get("tier")),
    },
  });
  revalidatePath(`/admin/referentiels/${id}`);
}

export async function setStatut(formData: FormData) {
  await requireSuperAdmin();
  const id = String(formData.get("id"));
  const statut = String(formData.get("statut")); // brouillon | calibre | publie
  await prisma.framework.update({ where: { id }, data: { statut } });
  revalidatePath(`/admin/referentiels/${id}`);
}

// --- Catégories ------------------------------------------------------------

export async function addCategory(formData: FormData) {
  await requireSuperAdmin();
  const fwId = String(formData.get("frameworkId"));
  const gridId = String(formData.get("gridId"));
  const nom = String(formData.get("nom") ?? "").trim();
  if (!nom) return;
  const code = slugify(String(formData.get("code") ?? "") || nom);
  const count = await prisma.category.count({ where: { gridId } });
  const exists = await prisma.category.findUnique({
    where: { gridId_code: { gridId, code } },
  });
  if (!exists) {
    await prisma.category.create({ data: { gridId, code, nom, ordre: count + 1 } });
  }
  revalidatePath(`/admin/referentiels/${fwId}`);
}

export async function deleteCategory(formData: FormData) {
  await requireSuperAdmin();
  const fwId = String(formData.get("frameworkId"));
  const gridId = String(formData.get("gridId"));
  const code = String(formData.get("code"));
  // Refuse si des compétences y sont rattachées.
  const used = await prisma.competency.count({ where: { gridId, categoryCode: code } });
  if (used === 0) {
    await prisma.category.deleteMany({ where: { gridId, code } });
  }
  revalidatePath(`/admin/referentiels/${fwId}`);
}

// --- Compétences -----------------------------------------------------------

export async function addCompetency(formData: FormData) {
  await requireSuperAdmin();
  const fwId = String(formData.get("frameworkId"));
  const gridId = String(formData.get("gridId"));
  const nom = String(formData.get("nom") ?? "").trim();
  const categoryCode = String(formData.get("categoryCode") ?? "");
  if (!nom || !categoryCode) return;
  const code = slugify(String(formData.get("code") ?? "") || nom);
  const count = await prisma.competency.count({ where: { gridId } });
  const exists = await prisma.competency.findUnique({
    where: { gridId_code: { gridId, code } },
  });
  if (!exists) {
    await prisma.competency.create({
      data: {
        gridId,
        categoryCode,
        code,
        nom,
        ordre: count + 1,
        ancrage1: String(formData.get("ancrage1") ?? "") || null,
        ancrage3: String(formData.get("ancrage3") ?? "") || null,
        ancrage5: String(formData.get("ancrage5") ?? "") || null,
      },
    });
  }
  revalidatePath(`/admin/referentiels/${fwId}`);
}

export async function updateCompetency(formData: FormData) {
  await requireSuperAdmin();
  const fwId = String(formData.get("frameworkId"));
  const gridId = String(formData.get("gridId"));
  const code = String(formData.get("code"));
  await prisma.competency.update({
    where: { gridId_code: { gridId, code } },
    data: {
      nom: String(formData.get("nom") ?? "").trim(),
      categoryCode: String(formData.get("categoryCode") ?? ""),
      ancrage1: String(formData.get("ancrage1") ?? "") || null,
      ancrage3: String(formData.get("ancrage3") ?? "") || null,
      ancrage5: String(formData.get("ancrage5") ?? "") || null,
    },
  });
  revalidatePath(`/admin/referentiels/${fwId}`);
}

export async function deleteCompetency(formData: FormData) {
  await requireSuperAdmin();
  const fwId = String(formData.get("frameworkId"));
  const gridId = String(formData.get("gridId"));
  const code = String(formData.get("code"));
  await prisma.drill.deleteMany({ where: { frameworkId: fwId, competencyId: code } });
  await prisma.competency.deleteMany({ where: { gridId, code } });
  revalidatePath(`/admin/referentiels/${fwId}`);
}

// --- Drills (cartes) -------------------------------------------------------

export async function createDrill(formData: FormData) {
  await requireSuperAdmin();
  const fwId = String(formData.get("frameworkId"));
  const competencyId = String(formData.get("competencyId"));
  const mode = String(formData.get("mode"));
  const difficulty = Number(formData.get("difficulty") ?? 1);
  if (!competencyId) return;

  const optionsRaw = String(formData.get("optionsJson") ?? "");
  let options: unknown = undefined;
  if (mode === "reconnaissance" && optionsRaw) {
    try {
      options = JSON.parse(optionsRaw);
    } catch {
      options = undefined;
    }
  }

  // Identifiant lisible et unique.
  const prefix = `DRL-${competencyId.slice(0, 6).toUpperCase()}`;
  const n = (await prisma.drill.count({ where: { frameworkId: fwId } })) + 1;
  let id = `${prefix}-${String(n).padStart(2, "0")}`;
  while (await prisma.drill.findUnique({ where: { id } })) {
    id = `${prefix}-${Math.random().toString(36).slice(2, 6)}`;
  }

  await prisma.drill.create({
    data: {
      id,
      frameworkId: fwId,
      competencyId,
      scenarioContext: String(formData.get("scenarioContext") ?? "") || null,
      difficulty: Math.max(1, Math.min(3, difficulty)),
      mode,
      rappelTheorique: String(formData.get("rappelTheorique") ?? ""),
      stimulus: String(formData.get("stimulus") ?? ""),
      options: options as never,
      patientReactionSiBon: String(formData.get("patientReactionSiBon") ?? "") || null,
      modeleReponse: String(formData.get("modeleReponse") ?? ""),
    },
  });
  redirect(`/admin/referentiels/${fwId}`);
}

export async function deleteDrill(formData: FormData) {
  await requireSuperAdmin();
  const fwId = String(formData.get("frameworkId"));
  const id = String(formData.get("drillId"));
  await prisma.drill.delete({ where: { id } });
  revalidatePath(`/admin/referentiels/${fwId}`);
}

// --- Génération IA (renvoie un brouillon, ne crée rien) ---------------------

export async function generateDraftAction(input: {
  frameworkId: string;
  competencyCode: string;
  mode: "reconnaissance" | "production";
  difficulty: number;
}): Promise<{ ok: true; draft: DrillDraft } | { ok: false; error: string }> {
  await requireSuperAdmin();
  const fw = await prisma.framework.findUnique({ where: { id: input.frameworkId } });
  if (!fw) return { ok: false, error: "référentiel introuvable" };
  const comp = await prisma.competency.findUnique({
    where: { gridId_code: { gridId: fw.gridId, code: input.competencyCode } },
  });
  if (!comp) return { ok: false, error: "compétence introuvable" };

  try {
    const draft = await generateDrillDraft({
      frameworkNom: fw.nom,
      competenceNom: comp.nom,
      ancrage1: comp.ancrage1,
      ancrage3: comp.ancrage3,
      ancrage5: comp.ancrage5,
      mode: input.mode,
      difficulty: input.difficulty,
    });
    return { ok: true, draft };
  } catch (e) {
    if (e instanceof EvaluatorNotConfiguredError) {
      return { ok: false, error: "Clé API du fournisseur IA absente : configurez-la pour générer." };
    }
    return { ok: false, error: "Échec de la génération." };
  }
}
