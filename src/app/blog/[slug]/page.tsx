import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, Clock, GraduationCap, Sparkles } from "lucide-react";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { getAllPosts, getPostBySlug, extractHeadings, readingTime } from "@/lib/blog/posts";
import { AUDIENCE_LABEL, type Audience } from "@/lib/blog/schema";
import { resolveDomaineLink } from "@/lib/catalogue";
import { mdxComponents } from "../_components/mdx-components";

export const revalidate = 3600;

// Seuls les articles PUBLIÉS sont pré-générés. Un slug absent d'ici (draft)
// reste accessible : Next le rend à la demande (dynamicParams par défaut).
export async function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.frontmatter.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  const { frontmatter } = post;
  return {
    title: `${frontmatter.title} — MELETA`,
    description: frontmatter.description,
    keywords: frontmatter.keywords,
    // Drafts : jamais indexés, accessibles seulement par lien direct.
    robots: frontmatter.draft ? { index: false, follow: false } : undefined,
    openGraph: {
      title: frontmatter.title,
      description: frontmatter.description,
      type: "article",
      publishedTime: frontmatter.date.toISOString(),
      modifiedTime: frontmatter.updated?.toISOString(),
      images: frontmatter.cover ? [frontmatter.cover] : undefined,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();
  const { frontmatter, content } = post;

  const headings = extractHeadings(content);
  const minutes = readingTime(content);

  // Référentiels liés (frontmatter) : résolus + filtrés (inconnus/non publiés ignorés).
  const relatedDomaines = (
    await Promise.all(frontmatter.framework.map((f) => resolveDomaineLink(f)))
  ).filter((d): d is { slug: string; nom: string } => d !== null);

  const { content: rendered } = await compileMDX({
    source: content,
    components: mdxComponents,
    options: {
      parseFrontmatter: false, // déjà extrait par gray-matter (src/lib/blog/posts.ts)
      mdxOptions: { remarkPlugins: [remarkGfm] },
    },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/blog"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-4 w-4" /> Tous les articles
      </Link>

      {frontmatter.draft && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          Brouillon — non listé, non indexé. Visible uniquement par ce lien direct.
        </div>
      )}

      <div className="mt-3">
        <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--accent)]">
          {AUDIENCE_LABEL[frontmatter.audience]}
        </span>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {frontmatter.title}
        </h1>
        <div className="mt-2 flex items-center gap-3 text-sm text-[var(--muted)]">
          <span>{frontmatter.date.toLocaleDateString("fr-FR", { dateStyle: "long" })}</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {minutes} min de lecture
          </span>
        </div>
      </div>

      {/* Table des matières auto (h2/h3 du Markdown source) */}
      {headings.length > 0 && (
        <nav className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface-tint)] p-4 text-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Sommaire
          </div>
          <ul className="mt-2 space-y-1.5">
            {headings.map((h) => (
              <li key={h.slug} className={h.depth === 3 ? "ml-4" : ""}>
                <a href={`#${h.slug}`} className="text-[var(--accent)] hover:underline">
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <article className="prose-blog mt-8">{rendered}</article>

      {relatedDomaines.length > 0 && (
        <div className="not-prose mt-10 rounded-xl border border-[var(--border)] bg-[var(--surface-tint)] p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {relatedDomaines.length > 1 ? "Domaines liés" : "Domaine lié"}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {relatedDomaines.map((d) => (
              <Link
                key={d.slug}
                href={`/domaines/${d.slug}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent-border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)]"
              >
                {d.nom} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ))}
          </div>
        </div>
      )}

      <PostCta audience={frontmatter.audience} />

      {/* Données structurées SEO : schema.org BlogPosting. */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: frontmatter.title,
            description: frontmatter.description,
            datePublished: frontmatter.date.toISOString(),
            dateModified: (frontmatter.updated ?? frontmatter.date).toISOString(),
            keywords: frontmatter.keywords.join(", "),
          }),
        }}
      />
    </div>
  );
}

function PostCta({ audience }: { audience: Audience }) {
  const showPraticien = audience === "praticien" || audience === "les-deux";
  const showEcole = audience === "ecole" || audience === "les-deux";
  return (
    <div className="not-prose mt-10 grid gap-3 border-t border-[var(--border)] pt-8 sm:grid-cols-2">
      {showPraticien && (
        <div className="rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-5">
          <div className="flex items-center gap-2 font-semibold text-[var(--accent)]">
            <Sparkles className="h-4 w-4" /> Vous êtes thérapeute ou coach ?
          </div>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Essayez gratuitement l&apos;entraînement clinique par compétences — sans carte
            bancaire.
          </p>
          <Link
            href="/inscription"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
          >
            Essai gratuit <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
      {showEcole && (
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="flex items-center gap-2 font-semibold">
            <GraduationCap className="h-4 w-4 text-[var(--accent)]" /> Vous formez des
            praticiens ?
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Un accès dédié pour l&apos;ensemble de vos apprenants, avec un tarif adapté au
            volume.
          </p>
          <Link
            href="/demande-demo"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]"
          >
            Demander une démo <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
