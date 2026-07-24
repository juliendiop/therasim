import Link from "next/link";
import { ArrowLeft, Quote, Check, X, Eye } from "lucide-react";
import { listTestimonials, testimonialAttribution } from "@/lib/beta-bilan";
import { publishTestimonialAction, rejectTestimonialAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  published: "Publié",
  rejected: "Rejeté",
};

function fmt(d: Date): string {
  return d.toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" });
}

export default async function AdminTestimonialsPage() {
  const rows = await listTestimonials();
  const pending = rows.filter((r) => r.status === "pending").length;

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
          <Quote className="h-5 w-5 text-[var(--accent)]" />
          <h2 className="text-lg font-semibold">Témoignages ({rows.length})</h2>
        </div>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {pending} en attente de validation. Seuls les témoignages <b>publiés</b> apparaissent sur
          le site, avec le mode d&apos;affichage choisi par l&apos;auteur.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-[var(--border)] bg-white p-6 text-sm text-[var(--muted)]">
          Aucun témoignage pour le moment.
        </p>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl border border-[var(--border)] bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">{r.email}</span>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      r.status === "published"
                        ? "bg-green-100 text-green-800"
                        : r.status === "rejected"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                  <span className="text-xs text-[var(--muted)]">{fmt(r.createdAt)}</span>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--muted)]">
                <Eye className="h-3.5 w-3.5" />
                Affichage public :{" "}
                <b className="text-[var(--foreground)]">
                  {testimonialAttribution({
                    displayMode: r.displayMode,
                    firstName: r.firstName,
                    profession: r.profession,
                  })}
                </b>
              </div>

              <blockquote className="mt-3 space-y-1 border-l-2 border-[var(--accent-border)] pl-3 text-sm">
                <p>
                  <span className="text-[var(--muted)]">Avant MELETA, je</span> {r.beforeText}
                </p>
                <p>
                  <span className="text-[var(--muted)]">En utilisant MELETA, j&apos;ai</span>{" "}
                  {r.duringText}
                </p>
                <p>
                  <span className="text-[var(--muted)]">Aujourd&apos;hui, je</span> {r.afterText}
                </p>
              </blockquote>

              <div className="mt-3 flex gap-2">
                {r.status !== "published" && (
                  <form action={publishTestimonialAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--accent-hover)]">
                      <Check className="h-3.5 w-3.5" /> Publier sur le site
                    </button>
                  </form>
                )}
                {r.status !== "rejected" && (
                  <form action={rejectTestimonialAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:border-red-300 hover:text-red-700">
                      <X className="h-3.5 w-3.5" /> {r.status === "published" ? "Retirer" : "Rejeter"}
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
