import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { parseOptions } from "@/lib/drill-view";
import {
  addCategory,
  addCompetency,
  deleteCategory,
  deleteCompetency,
  deleteDrill,
  setStatut,
  updateReferential,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function ReferentielDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const fw = await prisma.framework.findUnique({ where: { id } });
  if (!fw) notFound();

  const [categories, competencies, drills] = await Promise.all([
    prisma.category.findMany({ where: { gridId: fw.gridId }, orderBy: { ordre: "asc" } }),
    prisma.competency.findMany({ where: { gridId: fw.gridId }, orderBy: { ordre: "asc" } }),
    prisma.drill.findMany({ where: { frameworkId: id }, orderBy: { id: "asc" } }),
  ]);

  const drillsByComp = new Map<string, typeof drills>();
  for (const d of drills) {
    if (!drillsByComp.has(d.competencyId)) drillsByComp.set(d.competencyId, []);
    drillsByComp.get(d.competencyId)!.push(d);
  }

  return (
    <div className="space-y-8">
      <Link href="/admin/referentiels" className="text-sm text-[var(--muted)] hover:underline">
        ← Tous les référentiels
      </Link>

      {/* Métadonnées + statut */}
      <section className="grid gap-4 lg:grid-cols-3">
        <form
          action={updateReferential}
          className="space-y-3 rounded-xl border border-[var(--border)] bg-white p-4 lg:col-span-2"
        >
          <input type="hidden" name="id" value={id} />
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium">Nom</label>
              <input
                name="nom"
                defaultValue={fw.nom}
                className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Type</label>
              <select
                name="type"
                defaultValue={fw.type}
                className="mt-1 rounded-lg border border-[var(--border)] p-2 text-sm"
              >
                <option value="approche">Approche</option>
                <option value="transversale">Transversale</option>
                <option value="situation">Situation</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <div>
              <label className="text-xs font-medium">Nature</label>
              <select
                name="nature"
                defaultValue={fw.nature}
                className="mt-1 rounded-lg border border-[var(--border)] p-2 text-sm"
              >
                <option value="specialite">Spécialité (comptée dans le quota)</option>
                <option value="socle">Socle (inclus partout, hors quota)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">Palier (réservé, futur)</label>
              <select
                name="tier"
                defaultValue={fw.tier}
                className="mt-1 rounded-lg border border-[var(--border)] p-2 text-sm"
              >
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Description (interne)</label>
            <textarea
              name="description"
              defaultValue={fw.description ?? ""}
              rows={2}
              className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
            />
          </div>

          {/* Champs PUBLICS (page /domaines) */}
          <div className="border-t border-[var(--border)] pt-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Page publique /domaines
            </div>
            <div className="mt-2 grid gap-3">
              <div>
                <label className="text-xs font-medium">Slug public (URL)</label>
                <input
                  name="slug"
                  defaultValue={fw.slug ?? ""}
                  placeholder="entretien-motivationnel"
                  className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm font-mono"
                />
                <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                  /domaines/<b>{fw.slug ?? fw.id}</b> — évitez de le changer une fois indexé.
                </p>
              </div>
              <div>
                <label className="text-xs font-medium">Intro publique (200-300 mots)</label>
                <textarea
                  name="introPublique"
                  defaultValue={fw.introPublique ?? ""}
                  rows={5}
                  placeholder="Texte d'accroche affiché en tête de la page publique (repli sur la description si vide)."
                  className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium">Auteur(s)</label>
                  <input
                    name="auteurs"
                    defaultValue={fw.auteurs ?? ""}
                    placeholder="ex. Dr X, Y"
                    className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium">Cadre de référence</label>
                  <input
                    name="cadreReference"
                    defaultValue={fw.cadreReference ?? ""}
                    placeholder="ex. d'après Miller & Rollnick"
                    className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          <button className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]">
            Enregistrer
          </button>
          <span className="ml-2 text-xs text-[var(--muted)]">
            id : <code>{fw.id}</code> · grille : <code>{fw.gridId}</code>
          </span>
        </form>

        <form
          action={setStatut}
          className="space-y-2 rounded-xl border border-[var(--border)] bg-white p-4"
        >
          <input type="hidden" name="id" value={id} />
          <label className="text-xs font-medium">Statut</label>
          <select
            name="statut"
            defaultValue={fw.statut}
            className="w-full rounded-lg border border-[var(--border)] p-2 text-sm"
          >
            <option value="brouillon">Brouillon</option>
            <option value="calibre">Calibré (évaluateur calé)</option>
            <option value="publie">Publié (attribuable)</option>
          </select>
          <button className="w-full rounded-lg border border-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)]">
            Mettre à jour le statut
          </button>
          <p className="text-[11px] text-[var(--muted)]">
            Un référentiel n&apos;est attribuable (via un pack) que <b>publié</b>. Ne publier
            qu&apos;après validation clinique + calibration de l&apos;évaluateur.
          </p>
        </form>
      </section>

      {/* Catégories */}
      <section>
        <h3 className="text-sm font-semibold">Catégories</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {categories.map((c) => (
            <span
              key={c.code}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs"
            >
              {c.nom}
              <form action={deleteCategory}>
                <input type="hidden" name="frameworkId" value={id} />
                <input type="hidden" name="gridId" value={fw.gridId} />
                <input type="hidden" name="code" value={c.code} />
                <button className="text-[var(--muted)] hover:text-red-600" title="Supprimer (si vide)">
                  ×
                </button>
              </form>
            </span>
          ))}
          <form action={addCategory} className="inline-flex items-center gap-1">
            <input type="hidden" name="frameworkId" value={id} />
            <input type="hidden" name="gridId" value={fw.gridId} />
            <input
              name="nom"
              placeholder="Nouvelle catégorie"
              className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs"
            />
            <button className="rounded-lg bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200">
              + Ajouter
            </button>
          </form>
        </div>
      </section>

      {/* Compétences + cartes */}
      <section>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Compétences & cartes</h3>
        </div>

        {categories.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            Ajoutez d&apos;abord au moins une catégorie pour pouvoir créer des compétences.
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            {categories.map((cat) => {
              const comps = competencies.filter((c) => c.categoryCode === cat.code);
              return (
                <div key={cat.code} className="rounded-xl border border-[var(--border)] bg-white">
                  <div className="border-b border-[var(--border)] px-4 py-2 text-sm font-medium">
                    {cat.nom}
                  </div>
                  <div className="divide-y divide-[var(--border)]">
                    {comps.map((c) => {
                      const cDrills = drillsByComp.get(c.code) ?? [];
                      return (
                        <div key={c.code} className="px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium">{c.nom}</div>
                              <div className="mt-0.5 text-xs text-[var(--muted)]">
                                <span className="text-red-500">1·</span> {c.ancrage1 || "—"}{" "}
                                <span className="text-amber-500">3·</span> {c.ancrage3 || "—"}{" "}
                                <span className="text-green-600">5·</span> {c.ancrage5 || "—"}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <Link
                                href={`/admin/referentiels/${id}/cartes/nouvelle?competency=${c.code}`}
                                className="inline-flex items-center gap-1 rounded-lg border border-[var(--accent)] px-2.5 py-1 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                              >
                                <Plus className="h-3.5 w-3.5" /> Carte
                              </Link>
                              <form action={deleteCompetency}>
                                <input type="hidden" name="frameworkId" value={id} />
                                <input type="hidden" name="gridId" value={fw.gridId} />
                                <input type="hidden" name="code" value={c.code} />
                                <button
                                  className="text-[var(--muted)] hover:text-red-600"
                                  title="Supprimer la compétence et ses cartes"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </form>
                            </div>
                          </div>

                          {/* Cartes de la compétence */}
                          {cDrills.length > 0 && (
                            <div className="mt-2 space-y-1.5">
                              {cDrills.map((d) => {
                                const opts = parseOptions(d.options);
                                return (
                                  <div
                                    key={d.id}
                                    className="rounded-lg bg-gray-50 px-3 py-2 text-xs"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium">
                                        {d.mode === "reconnaissance" ? "QCM" : "Production"} · diff{" "}
                                        {d.difficulty} · <code>{d.id}</code>
                                      </span>
                                      <form action={deleteDrill}>
                                        <input type="hidden" name="frameworkId" value={id} />
                                        <input type="hidden" name="drillId" value={d.id} />
                                        <button className="text-[var(--muted)] hover:text-red-600">
                                          supprimer
                                        </button>
                                      </form>
                                    </div>
                                    <div className="mt-1 italic text-[var(--muted)]">
                                      « {d.stimulus} »
                                    </div>
                                    {opts.length > 0 && (
                                      <ul className="mt-1 space-y-0.5">
                                        {opts.map((o, i) => (
                                          <li key={i} className={o.is_best ? "text-green-700" : ""}>
                                            {o.is_best ? "✓" : "·"} {o.text}{" "}
                                            <span className="text-[var(--muted)]">({o.score})</span>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {comps.length === 0 && (
                      <div className="px-4 py-3 text-xs text-[var(--muted)]">
                        Aucune compétence dans cette catégorie.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Ajouter une compétence */}
        {categories.length > 0 && (
          <form
            action={addCompetency}
            className="mt-4 grid gap-3 rounded-xl border border-dashed border-[var(--border)] bg-white p-4 sm:grid-cols-2"
          >
            <input type="hidden" name="frameworkId" value={id} />
            <input type="hidden" name="gridId" value={fw.gridId} />
            <div>
              <label className="text-xs font-medium">Nom de la compétence</label>
              <input
                name="nom"
                required
                placeholder="ex. Reflets"
                className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Catégorie</label>
              <select
                name="categoryCode"
                className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
              >
                {categories.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.nom}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 grid gap-2 sm:grid-cols-3">
              <input
                name="ancrage1"
                placeholder="Ancrage 1 (faible)"
                className="rounded-lg border border-[var(--border)] p-2 text-xs"
              />
              <input
                name="ancrage3"
                placeholder="Ancrage 3 (moyen)"
                className="rounded-lg border border-[var(--border)] p-2 text-xs"
              />
              <input
                name="ancrage5"
                placeholder="Ancrage 5 (excellent)"
                className="rounded-lg border border-[var(--border)] p-2 text-xs"
              />
            </div>
            <div className="sm:col-span-2">
              <button className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]">
                Ajouter la compétence
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
