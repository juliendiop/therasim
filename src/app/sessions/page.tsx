import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Radio } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getSessionPairs, roleCanManageLive } from "@/lib/live";
import { effectiveFrameworkIds } from "@/lib/entitlements";
import CreateSessionForm from "./create-form";

export const dynamic = "force-dynamic";

const STATUT: Record<string, { label: string; cls: string }> = {
  brouillon: { label: "brouillon", cls: "bg-gray-100 text-gray-600" },
  ouverte: { label: "ouverte", cls: "bg-amber-50 text-amber-700" },
  en_cours: { label: "en cours", cls: "bg-green-50 text-green-700" },
  fermee: { label: "fermée", cls: "bg-gray-100 text-gray-500" },
};

export default async function SessionsPage() {
  const user = await requireUser();
  if (!roleCanManageLive(user.role)) redirect("/catalogue");

  const ids = await effectiveFrameworkIds(user.tenantId);
  const frameworks = await prisma.framework.findMany({
    where: { statut: "publie", id: { in: Array.from(ids) } },
    orderBy: { nom: "asc" },
  });

  const compsByFw: Record<string, { code: string; nom: string; cat: string }[]> = {};
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
  }

  const sessions = await prisma.liveSession.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: "desc" },
  });
  const fwNom = new Map(frameworks.map((f) => [f.id, f.nom]));

  return (
    <div>
      <div className="flex items-center gap-2">
        <Radio className="h-5 w-5 text-[var(--accent)]" />
        <h1 className="text-xl font-semibold">Sessions live</h1>
      </div>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Créez une étude de cas à faire passer en direct à un groupe (en formation, sur Zoom…),
        avec un lien à partager, un compte à rebours, et les résultats par compétence.
      </p>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        Nouvelle session
      </h2>
      <div className="mt-3">
        <CreateSessionForm frameworks={frameworks.map((f) => ({ id: f.id, nom: f.nom }))} compsByFw={compsByFw} />
      </div>

      {sessions.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Mes sessions
          </h2>
          <div className="mt-3 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-white">
            {sessions.map((s) => {
              const st = STATUT[s.statut] ?? STATUT.brouillon;
              const ps = getSessionPairs(s);
              const fwLabel =
                Array.from(new Set(ps.map((p) => p.frameworkId)))
                  .map((f) => fwNom.get(f) ?? f)
                  .join(", ") || "—";
              return (
                <Link
                  key={s.id}
                  href={`/sessions/${s.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{s.titre}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>
                        {st.label}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {fwLabel} · {ps.length} compétence(s) ·{" "}
                      {s.mode === "apprentissage" ? "apprentissage" : "évaluation"} · {s.durationMin} min
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-[var(--muted)]" />
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
