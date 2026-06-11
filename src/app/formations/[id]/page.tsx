import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Play, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageLive } from "@/lib/roles";
import { effectiveFrameworkIds } from "@/lib/entitlements";
import {
  createSessionFromFormation,
  createSessionFromModule,
  deleteFormation,
  deleteModule,
} from "../actions";
import AddModuleForm from "./add-module-form";

type ModuleItem = { frameworkId: string; competencies: string[] };

export const dynamic = "force-dynamic";

export default async function FormationDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!canManageLive(user.role)) redirect("/catalogue");

  const formation = await prisma.formation.findUnique({ where: { id } });
  if (!formation || formation.tenantId !== user.tenantId) notFound();

  const modules = await prisma.formationModule.findMany({
    where: { formationId: id },
    orderBy: { ordre: "asc" },
  });

  // Référentiels accessibles + leurs compétences (pour le formulaire et l'affichage).
  const ids = await effectiveFrameworkIds(user.tenantId);
  const frameworks = await prisma.framework.findMany({
    where: { statut: "publie", id: { in: Array.from(ids) } },
    orderBy: { nom: "asc" },
  });
  const fwNom = new Map(frameworks.map((f) => [f.id, f.nom]));
  const compsByFw: Record<string, { code: string; nom: string; cat: string }[]> = {};
  const nomByFwCode = new Map<string, string>();
  for (const f of frameworks) {
    const [comps, cats] = await Promise.all([
      prisma.competency.findMany({ where: { gridId: f.gridId }, orderBy: { ordre: "asc" } }),
      prisma.category.findMany({ where: { gridId: f.gridId } }),
    ]);
    const catNom = new Map(cats.map((c) => [c.code, c.nom]));
    compsByFw[f.id] = comps.map((c) => ({
      code: c.code,
      nom: c.nom,
      cat: catNom.get(c.categoryCode) ?? c.categoryCode,
    }));
    for (const c of comps) nomByFwCode.set(`${f.id}:${c.code}`, c.nom);
  }

  return (
    <div>
      <Link
        href="/formations"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-4 w-4" /> Formations
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{formation.titre}</h1>
          {formation.description && (
            <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">{formation.description}</p>
          )}
        </div>
        <form action={deleteFormation}>
          <input type="hidden" name="id" value={id} />
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] hover:border-red-300 hover:text-red-600">
            <Trash2 className="h-4 w-4" /> Supprimer
          </button>
        </form>
      </div>

      {/* Modules */}
      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        Modules
      </h2>
      <div className="mt-3 space-y-3">
        {modules.length === 0 && (
          <p className="text-sm text-[var(--muted)]">
            Aucun module. Ajoutez-en un ci-dessous.
          </p>
        )}
        {modules.map((m) => {
          const items = m.items as ModuleItem[];
          const totalComps = items.reduce((n, it) => n + it.competencies.length, 0);
          return (
            <div key={m.id} className="rounded-xl border border-[var(--border)] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{m.nom}</div>
                  <div className="text-xs text-[var(--muted)]">
                    {items.length} référentiel(s) · {totalComps} compétence(s)
                  </div>
                </div>
                <form action={deleteModule}>
                  <input type="hidden" name="id" value={m.id} />
                  <button className="text-[var(--muted)] hover:text-red-600" title="Supprimer le module">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </form>
              </div>

              <div className="mt-2 space-y-1.5">
                {items.map((it) => (
                  <div key={it.frameworkId} className="text-xs">
                    <span className="font-medium text-[var(--muted)]">
                      {fwNom.get(it.frameworkId) ?? it.frameworkId} :
                    </span>{" "}
                    {it.competencies.map((code) => (
                      <span
                        key={code}
                        className="mr-1.5 inline-block rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[var(--accent)]"
                      >
                        {nomByFwCode.get(`${it.frameworkId}:${code}`) ?? code}
                      </span>
                    ))}
                  </div>
                ))}
              </div>

              {/* Lancer une session live pour ce module */}
              <form
                action={createSessionFromModule}
                className="mt-3 flex flex-wrap items-end gap-2 border-t border-[var(--border)] pt-3"
              >
                <input type="hidden" name="moduleId" value={m.id} />
                <div>
                  <label className="text-[11px] font-medium text-[var(--muted)]">Mode</label>
                  <select
                    name="mode"
                    defaultValue="evaluation"
                    className="mt-0.5 block rounded-lg border border-[var(--border)] p-1.5 text-xs"
                  >
                    <option value="evaluation">Évaluation</option>
                    <option value="apprentissage">Apprentissage</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[var(--muted)]">Durée (min)</label>
                  <input
                    type="number"
                    name="durationMin"
                    defaultValue={15}
                    min={1}
                    max={180}
                    className="mt-0.5 block w-20 rounded-lg border border-[var(--border)] p-1.5 text-xs"
                  />
                </div>
                <button className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--accent-hover)]">
                  <Play className="h-3.5 w-3.5" /> Lancer une session live
                </button>
              </form>
            </div>
          );
        })}
      </div>

      {/* Session pour toute la formation */}
      {modules.length > 0 && (
        <div className="mt-5 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-4">
          <div className="text-sm font-semibold">Évaluation de toute la formation</div>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Une seule étude de cas couvrant les compétences de tous les modules.
          </p>
          <form
            action={createSessionFromFormation}
            className="mt-3 flex flex-wrap items-end gap-2"
          >
            <input type="hidden" name="formationId" value={id} />
            <div>
              <label className="text-[11px] font-medium text-[var(--muted)]">Mode</label>
              <select
                name="mode"
                defaultValue="evaluation"
                className="mt-0.5 block rounded-lg border border-[var(--border)] bg-white p-1.5 text-xs"
              >
                <option value="evaluation">Évaluation</option>
                <option value="apprentissage">Apprentissage</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-[var(--muted)]">Durée (min)</label>
              <input
                type="number"
                name="durationMin"
                defaultValue={20}
                min={1}
                max={180}
                className="mt-0.5 block w-20 rounded-lg border border-[var(--border)] bg-white p-1.5 text-xs"
              />
            </div>
            <button className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--accent-hover)]">
              <Play className="h-3.5 w-3.5" /> Créer la session globale
            </button>
          </form>
        </div>
      )}

      {/* Ajouter un module */}
      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        Ajouter un module
      </h2>
      <div className="mt-3">
        <AddModuleForm
          formationId={id}
          frameworks={frameworks.map((f) => ({ id: f.id, nom: f.nom }))}
          compsByFw={compsByFw}
        />
      </div>
    </div>
  );
}
