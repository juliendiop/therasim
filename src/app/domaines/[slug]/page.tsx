import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, Check, Quote, Sparkles, Users } from "lucide-react";
import {
  getPublicDomaine,
  resolveDomaineParam,
  publishedDomaineSlugs,
  type DomaineDetail,
} from "@/lib/catalogue";
import { canonicalBaseUrl } from "@/lib/site-url";
import { TYPE_LABEL } from "@/lib/ui";

export const revalidate = 86400;

// Pré-génère les référentiels publiés : aucun hit DB par requête de crawler.
export async function generateStaticParams() {
  const rows = await publishedDomaineSlugs();
  return rows.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const d = await getPublicDomaine(slug);
  if (!d) return {};
  const description = (d.intro ?? `Travaillez « ${d.nom} » par compétences sur MELETA.`).slice(0, 300);
  const url = `/domaines/${d.slug}`;
  return {
    title: `${d.nom} — MELETA`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${d.nom} — MELETA`,
      description,
      type: "article",
      url,
    },
  };
}

export default async function DomainePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Résolution + redirection 301 d'un ancien lien /domaines/<id> vers le slug public.
  const resolved = await resolveDomaineParam(slug);
  if (!resolved) notFound();
  if (resolved.matchedBy === "id") permanentRedirect(`/domaines/${resolved.slug}`);

  const d = await getPublicDomaine(resolved.slug);
  if (!d) notFound();

  return (
    <div className="animate-in mx-auto max-w-3xl">
      <Link
        href="/domaines"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-4 w-4" /> Tous les domaines
      </Link>

      {/* En-tête */}
      <header className="mt-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--accent)]">
            {TYPE_LABEL[d.type] ?? d.type}
          </span>
          {d.nature === "socle" && (
            <span className="rounded-full bg-[var(--ochre-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--ochre)]">
              Socle — inclus partout
            </span>
          )}
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{d.nom}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
          <span>
            {d.competencyCount} compétence{d.competencyCount > 1 ? "s" : ""}
          </span>
          <span>·</span>
          <span>
            {d.casCount} cas jouable{d.casCount > 1 ? "s" : ""}
          </span>
          {d.cadreReference && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5" /> {d.cadreReference}
              </span>
            </>
          )}
        </div>
      </header>

      {/* Intro publique */}
      {d.intro && (
        <div className="prose-blog mt-6 whitespace-pre-line text-[var(--ink-soft)]">{d.intro}</div>
      )}

      {/* Compétences par axe */}
      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          <Sparkles className="h-4 w-4 text-[var(--ochre)]" /> Les compétences travaillées
        </h2>
        <div className="mt-4 space-y-6">
          {d.categories.map((cat) => (
            <div key={cat.code}>
              <h3 className="text-sm font-semibold">{cat.nom}</h3>
              <div className="mt-2 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-white">
                {cat.competencies.map((c) => (
                  <div key={c.code} className="flex items-start gap-3 px-4 py-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
                    <div>
                      <div className="font-medium">{c.nom}</div>
                      {c.description && (
                        <div className="mt-0.5 text-sm text-[var(--muted)]">{c.description}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Exemple de situation (non jouable) */}
      {d.exempleCas && (
        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            <Quote className="h-4 w-4 text-[var(--accent)]" /> Un exemple de situation
          </h2>
          <figure className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-tint)] p-5">
            <div className="font-semibold">{d.exempleCas.titre}</div>
            {d.exempleCas.contexte && (
              <p className="mt-1 text-sm text-[var(--ink-soft)]">{d.exempleCas.contexte}</p>
            )}
            <figcaption className="mt-3 text-xs text-[var(--muted)]">
              Aperçu — la situation se joue une fois connecté, auprès d&apos;un patient simulé.
            </figcaption>
          </figure>
        </section>
      )}

      {/* Auteurs */}
      {d.auteurs && (
        <p className="mt-8 inline-flex items-center gap-1.5 text-sm text-[var(--muted)]">
          <Users className="h-4 w-4" /> Contenu conçu par {d.auteurs}.
        </p>
      )}

      {/* CTA */}
      <section className="mt-10 rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-6 text-center">
        <h2 className="text-lg font-semibold">Essayez « {d.nom} »</h2>
        <p className="mx-auto mt-1 max-w-lg text-sm text-[var(--ink-soft)]">
          Faites un exercice gratuitement, sans compte — puis créez votre espace pour suivre
          votre progression.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/#demo"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent)] hover:bg-white"
          >
            Essayer la démo
          </Link>
          <Link
            href="/inscription"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
          >
            Créer mon compte <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <CourseJsonLd domaine={d} />
    </div>
  );
}

/** Balisage schema.org Course (sous-classe de LearningResource, éligible rich results),
 *  avec `teaches` = compétences en DefinedTerm. Pas de hasCourseInstance ni offers. */
function CourseJsonLd({ domaine }: { domaine: DomaineDetail }) {
  const base = canonicalBaseUrl();
  const teaches = domaine.categories.flatMap((cat) =>
    cat.competencies.map((c) => ({
      "@type": "DefinedTerm",
      name: c.nom,
      ...(c.description ? { description: c.description } : {}),
    })),
  );
  const data = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: domaine.nom,
    description: domaine.intro ?? `Travaillez « ${domaine.nom} » par compétences sur MELETA.`,
    url: `${base}/domaines/${domaine.slug}`,
    inLanguage: "fr",
    provider: { "@type": "Organization", name: "MELETA", url: base },
    ...(teaches.length > 0 ? { teaches } : {}),
  };
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
