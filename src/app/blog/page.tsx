import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import { getAllPosts, filterByAudience, readingTime } from "@/lib/blog/posts";
import { AUDIENCE_LABEL, type Audience } from "@/lib/blog/schema";

// SSG + revalidation (pas de force-dynamic) : le contenu ne change qu'au
// redéploiement (commit), mais on garde une revalidation périodique standard.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Blog — MELETA",
  description:
    "Conseils et ressources pour les thérapeutes, coachs et organismes de formation sur l'entraînement clinique par compétences.",
};

const PAGE_SIZE = 10;

const AUDIENCE_FILTERS: { value: Audience | "toutes"; label: string }[] = [
  { value: "toutes", label: "Tout" },
  { value: "praticien", label: "Thérapeutes & coachs" },
  { value: "ecole", label: "Écoles & organismes" },
];

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; audience?: string }>;
}) {
  const sp = await searchParams;
  const audience: Audience | "toutes" =
    sp.audience === "praticien" || sp.audience === "ecole" ? sp.audience : "toutes";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const all = filterByAudience(getAllPosts(), audience);
  const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const posts = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hrefFor = (p: number) => {
    const params = new URLSearchParams();
    if (audience !== "toutes") params.set("audience", audience);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/blog?${qs}` : "/blog";
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">Blog</h1>
      <p className="mt-2 text-[var(--ink-soft)]">
        Ressources et retours d&apos;expérience sur l&apos;entraînement clinique par
        compétences.
      </p>

      {/* Filtre par audience */}
      <div className="mt-5 flex flex-wrap gap-2">
        {AUDIENCE_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "toutes" ? "/blog" : `/blog?audience=${f.value}`}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              audience === f.value
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {posts.length === 0 ? (
        <p className="mt-8 text-sm text-[var(--muted)]">Aucun article pour l&apos;instant.</p>
      ) : (
        <div className="mt-6 space-y-4">
          {posts.map((post) => (
            <Link
              key={post.frontmatter.slug}
              href={`/blog/${post.frontmatter.slug}`}
              className="group block rounded-2xl border border-[var(--border)] bg-white p-5 transition hover:border-[var(--accent)] hover:shadow-sm"
            >
              <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 font-medium text-[var(--accent)]">
                  {AUDIENCE_LABEL[post.frontmatter.audience]}
                </span>
                <span>
                  {post.frontmatter.date.toLocaleDateString("fr-FR", { dateStyle: "long" })}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {readingTime(post.content)} min
                </span>
              </div>
              <h2 className="mt-2 text-xl font-semibold group-hover:text-[var(--accent)]">
                {post.frontmatter.title}
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">{post.frontmatter.description}</p>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link
              href={hrefFor(page - 1)}
              className="inline-flex items-center gap-1 font-medium text-[var(--accent)] hover:underline"
            >
              <ArrowLeft className="h-4 w-4" /> Précédent
            </Link>
          ) : (
            <span />
          )}
          <span className="text-[var(--muted)]">
            Page {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={hrefFor(page + 1)}
              className="inline-flex items-center gap-1 font-medium text-[var(--accent)] hover:underline"
            >
              Suivant <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
