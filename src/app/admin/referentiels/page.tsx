import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { createReferential } from "./actions";

export const dynamic = "force-dynamic";

const STATUT_LABEL: Record<string, { label: string; cls: string }> = {
  brouillon: { label: "brouillon", cls: "bg-gray-100 text-gray-600" },
  calibre: { label: "calibré", cls: "bg-amber-50 text-amber-700" },
  publie: { label: "publié", cls: "bg-green-50 text-green-700" },
};

export default async function ReferentielsPage() {
  const [frameworks, drillCounts, compCounts] = await Promise.all([
    prisma.framework.findMany({ orderBy: { nom: "asc" } }),
    prisma.drill.groupBy({ by: ["frameworkId"], _count: { _all: true } }),
    prisma.competency.groupBy({ by: ["gridId"], _count: { _all: true } }),
  ]);
  const drillByFw = new Map(drillCounts.map((d) => [d.frameworkId, d._count._all]));
  const compByGrid = new Map(compCounts.map((c) => [c.gridId, c._count._all]));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Catalogue central
        </h2>
        <div className="mt-3 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-white">
          {frameworks.map((f) => {
            const st = STATUT_LABEL[f.statut] ?? STATUT_LABEL.brouillon;
            return (
              <Link
                key={f.id}
                href={`/admin/referentiels/${f.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{f.nom}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>
                      {st.label}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {f.type} · {compByGrid.get(f.gridId) ?? 0} compétence(s) ·{" "}
                    {drillByFw.get(f.id) ?? 0} carte(s)
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-[var(--muted)]" />
              </Link>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Nouveau référentiel
        </h2>
        <form
          action={createReferential}
          className="mt-3 space-y-3 rounded-xl border border-[var(--border)] bg-white p-4"
        >
          <div>
            <label className="text-xs font-medium">Nom</label>
            <input
              name="nom"
              required
              placeholder="ex. Gestion de crise suicidaire"
              className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium">Type</label>
            <select
              name="type"
              className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
            >
              <option value="approche">Approche (EM, ACT…)</option>
              <option value="transversale">Compétence transversale (anamnèse…)</option>
              <option value="situation">Situation (burnout, deuil…)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">Description</label>
            <textarea
              name="description"
              rows={2}
              className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
            />
          </div>
          <button className="w-full rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Créer (brouillon)
          </button>
        </form>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Un nouveau référentiel naît en <b>brouillon</b>. Ajoutez catégories, compétences et
          cartes, puis publiez-le pour le rendre attribuable via un pack.
        </p>
      </div>
    </div>
  );
}
