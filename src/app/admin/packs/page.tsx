import { prisma } from "@/lib/prisma";
import { createPack, togglePackFramework } from "../actions";

export const dynamic = "force-dynamic";

export default async function PacksPage() {
  const [packs, frameworks, links] = await Promise.all([
    prisma.pack.findMany({ orderBy: { nom: "asc" } }),
    prisma.framework.findMany({ where: { statut: "publie" }, orderBy: { nom: "asc" } }),
    prisma.packFramework.findMany(),
  ]);

  const fwByPack = new Map<string, Set<string>>();
  for (const l of links) {
    if (!fwByPack.has(l.packId)) fwByPack.set(l.packId, new Set());
    fwByPack.get(l.packId)!.add(l.frameworkId);
  }

  return (
    <div className="space-y-8">
      {/* Création */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Nouveau pack
        </h2>
        <form
          action={createPack}
          className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--border)] bg-white p-4"
        >
          <div className="flex-1">
            <label className="text-xs font-medium">Nom du pack</label>
            <input
              name="nom"
              required
              placeholder="ex. Addictologie"
              className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
            />
          </div>
          <div className="flex-[2]">
            <label className="text-xs font-medium">Description</label>
            <input
              name="description"
              placeholder="ex. EM + Burnout pour les addictions"
              className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
            />
          </div>
          <button className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]">
            Créer
          </button>
        </form>
      </section>

      {/* Composition des packs */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Composition des packs
        </h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Cochez les référentiels du catalogue central à inclure dans chaque pack.
        </p>
        <div className="mt-3 space-y-4">
          {packs.map((p) => {
            const included = fwByPack.get(p.id) ?? new Set();
            return (
              <div key={p.id} className="rounded-xl border border-[var(--border)] bg-white p-4">
                <div className="font-medium">{p.nom}</div>
                {p.description && (
                  <div className="text-xs text-[var(--muted)]">{p.description}</div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {frameworks.map((f) => {
                    const on = included.has(f.id);
                    return (
                      <form key={f.id} action={togglePackFramework}>
                        <input type="hidden" name="packId" value={p.id} />
                        <input type="hidden" name="frameworkId" value={f.id} />
                        <button
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            on
                              ? "bg-[var(--accent)] text-white"
                              : "border border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]"
                          }`}
                        >
                          {on ? "✓ " : "+ "}
                          {f.nom}
                        </button>
                      </form>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Catalogue central (info) */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Catalogue central
        </h2>
        <div className="mt-3 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-white">
          {frameworks.map((f) => (
            <div key={f.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="font-medium">{f.nom}</span>
              <span className="text-xs text-[var(--muted)]">{f.type} · publié</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
