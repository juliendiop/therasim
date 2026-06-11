import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, GraduationCap } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageLive } from "@/lib/roles";
import { createFormation } from "./actions";

export const dynamic = "force-dynamic";

export default async function FormationsPage() {
  const user = await requireUser();
  if (!canManageLive(user.role)) redirect("/catalogue");

  const formations = await prisma.formation.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: "desc" },
  });
  const counts = await prisma.formationModule.groupBy({
    by: ["formationId"],
    _count: { _all: true },
  });
  const countBy = new Map(counts.map((c) => [c.formationId, c._count._all]));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-[var(--accent)]" />
          <h1 className="text-xl font-semibold">Formations</h1>
        </div>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Structurez une formation en <b>modules</b>. Chaque module cible un référentiel et les
          compétences qu&apos;il couvre. Vous lancez ensuite une session live par module.
        </p>

        <div className="mt-4 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-white">
          {formations.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-[var(--muted)]">
              Aucune formation pour l&apos;instant.
            </div>
          )}
          {formations.map((f) => (
            <Link
              key={f.id}
              href={`/formations/${f.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium">{f.titre}</div>
                <div className="text-xs text-[var(--muted)]">
                  {countBy.get(f.id) ?? 0} module(s)
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-[var(--muted)]" />
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Nouvelle formation
        </h2>
        <form
          action={createFormation}
          className="mt-3 space-y-3 rounded-xl border border-[var(--border)] bg-white p-4"
        >
          <div>
            <label className="text-xs font-medium">Titre</label>
            <input
              name="titre"
              required
              placeholder="ex. Initiation à l'entretien motivationnel"
              className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium">Description</label>
            <textarea
              name="description"
              rows={2}
              className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
            />
          </div>
          <button className="w-full rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]">
            Créer
          </button>
        </form>
      </div>
    </div>
  );
}
