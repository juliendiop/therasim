import Link from "next/link";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { listBetaBilan, BILAN_QUESTIONS } from "@/lib/beta-bilan";
import { isPromoterNps } from "@/lib/beta-bilan-constants";

export const dynamic = "force-dynamic";

function fmt(d: Date): string {
  return d.toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" });
}

export default async function AdminBetaBilanPage() {
  const rows = await listBetaBilan();
  const promoters = rows.filter((r) => isPromoterNps(r.nps)).length;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/beta"
          className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Bêta fermée
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-[var(--accent)]" />
          <h2 className="text-lg font-semibold">Bilans J+21 ({rows.length})</h2>
        </div>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {promoters} promoteur{promoters > 1 ? "s" : ""} (note 8-10) — chacun a reçu automatiquement
          la relance témoignage.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-[var(--border)] bg-white p-6 text-sm text-[var(--muted)]">
          Aucun bilan pour le moment.
        </p>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => {
            const answers = [r.q1, r.q2, r.q3, r.q4];
            const promoter = isPromoterNps(r.nps);
            return (
              <li key={r.id} className="rounded-xl border border-[var(--border)] bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{r.email}</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        promoter
                          ? "bg-green-100 text-green-800"
                          : r.nps <= 6
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      NPS {r.nps}/10
                    </span>
                    <span className="text-xs text-[var(--muted)]">{fmt(r.createdAt)}</span>
                  </div>
                </div>
                <dl className="mt-3 space-y-3">
                  {BILAN_QUESTIONS.map((q, i) => (
                    <div key={i}>
                      <dt className="text-xs font-medium text-[var(--muted)]">
                        {i + 1}. {q}
                      </dt>
                      <dd className="mt-0.5 whitespace-pre-wrap text-sm">
                        {answers[i]?.trim() ? answers[i] : <span className="text-[var(--muted)]">—</span>}
                      </dd>
                    </div>
                  ))}
                  <div>
                    <dt className="text-xs font-medium text-[var(--muted)]">
                      Pourquoi cette note ?
                    </dt>
                    <dd className="mt-0.5 whitespace-pre-wrap text-sm">
                      {r.npsWhy?.trim() ? r.npsWhy : <span className="text-[var(--muted)]">—</span>}
                    </dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
