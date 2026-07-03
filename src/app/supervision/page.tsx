import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Search, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { canSupervise } from "@/lib/roles";
import { listLearners } from "@/lib/supervision";
import { fmtDate, fmtDateTime } from "@/lib/ui";

export const dynamic = "force-dynamic";

// Vue d'ensemble formateur : tous les apprenants de la plateforme, avec un
// aperçu d'activité. Chaque ligne mène au détail (progression + débriefs + notes).
export default async function SupervisionPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  if (!canSupervise(user.role)) redirect("/accueil");
  const { q } = await searchParams;

  const learners = await listLearners(user.tenantId, q);

  return (
    <div>
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-[var(--accent)]" />
        <h1 className="text-xl font-semibold">Supervision</h1>
      </div>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Suivez la progression de vos apprenants, relisez leurs mises en situation et
        laissez-leur des retours.
      </p>

      <form className="mt-4 flex items-center gap-2" action="/supervision">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Rechercher par email…"
            className="w-full rounded-lg border border-[var(--border)] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--accent)]"
          />
        </div>
        <button className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium hover:border-[var(--accent)]">
          Filtrer
        </button>
      </form>

      <div className="mt-5 overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-[var(--muted)]">
            <tr>
              <th className="px-4 py-2">Apprenant</th>
              <th className="px-4 py-2">Depuis</th>
              <th className="px-4 py-2">Dernière activité</th>
              <th className="px-4 py-2 text-right">Exercices</th>
              <th className="px-4 py-2 text-right">Mises en situation</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {learners.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--muted)]">
                  Aucun apprenant {q ? "ne correspond à cette recherche" : "pour l'instant"}.
                </td>
              </tr>
            ) : (
              learners.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium">{l.email}</td>
                  <td className="px-4 py-2.5 text-[var(--muted)]">{fmtDate(l.createdAt)}</td>
                  <td className="px-4 py-2.5 text-[var(--muted)]">
                    {l.lastActivity ? fmtDateTime(l.lastActivity) : "jamais"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular">{l.attemptsCount}</td>
                  <td className="px-4 py-2.5 text-right tabular">{l.simCount}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Link
                      href={`/supervision/${l.id}`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)] hover:underline"
                    >
                      Voir <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
