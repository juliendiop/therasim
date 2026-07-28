import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Layers, Sparkles } from "lucide-react";
import { getPublicCatalogue } from "@/lib/catalogue";
import DomaineCardView from "@/app/_components/domaine-card";

// Régénéré au plus une fois par jour ; les référentiels publiés sont connus au build.
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Domaines cliniques — MELETA",
  description:
    "Le catalogue MELETA : un socle clinique inclus partout, et des spécialités à travailler par compétences, avec exercices et cas jouables auprès d'un patient simulé.",
  alternates: { canonical: "/domaines" },
  openGraph: {
    title: "Domaines cliniques — MELETA",
    description:
      "Un socle clinique inclus partout, et des spécialités à travailler par compétences.",
    type: "website",
  },
};

export default async function DomainesPage() {
  const { socle, specialites, plans } = await getPublicCatalogue();
  const cadrage = plans.map((p) => `${p.label} : ${p.quota == null ? "toutes" : p.quota}`);

  return (
    <div className="animate-in mx-auto max-w-5xl">
      <section className="mx-auto max-w-2xl pt-4 text-center sm:pt-8">
        <span className="text-xs font-semibold uppercase tracking-widest text-[var(--ochre)]">
          Catalogue
        </span>
        <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Les domaines cliniques
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-[var(--ink-soft)]">
          Chaque domaine se travaille compétence par compétence, avec des exercices et des
          mises en situation auprès d&apos;un patient simulé. Le socle est commun à toute
          pratique ; les spécialités approfondissent une approche ou une situation.
        </p>
      </section>

      {/* LE SOCLE */}
      {socle.length > 0 && (
        <section className="mt-10">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--ochre)]" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
              Le socle
            </h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--ink-soft)]">
            Les fondamentaux que tout praticien travaille, quelle que soit sa pratique.{" "}
            <b>Inclus dans tous les niveaux, y compris le compte gratuit</b>, sans jamais entamer
            votre choix de spécialités.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {socle.map((c) => (
              <DomaineCardView key={c.id} card={c} />
            ))}
          </div>
        </section>
      )}

      {/* LES SPÉCIALITÉS */}
      <section className="mt-12">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-[var(--accent)]" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Les spécialités
          </h2>
        </div>
        {cadrage.length > 0 && (
          <p className="mt-1 max-w-2xl text-sm text-[var(--ink-soft)]">
            Le nombre de spécialités que vous choisissez dépend de votre niveau —{" "}
            {cadrage.join(" · ")}.{" "}
            <Link href="/tarifs" className="font-medium text-[var(--accent)] hover:underline">
              Voir les forfaits
            </Link>
            .
          </p>
        )}
        {specialites.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-[var(--border)] bg-white p-6 text-center text-sm text-[var(--muted)]">
            De nouvelles spécialités arrivent bientôt.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {specialites.map((c) => (
              <DomaineCardView key={c.id} card={c} />
            ))}
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="mt-12 rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-6 text-center">
        <h2 className="text-lg font-semibold">Prêt à vous entraîner ?</h2>
        <p className="mx-auto mt-1 max-w-lg text-sm text-[var(--ink-soft)]">
          Le socle et une spécialité de votre choix sont accessibles gratuitement, sans carte
          bancaire.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/inscription"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
          >
            Commencer gratuitement <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/tarifs"
            className="inline-flex items-center rounded-lg border border-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent)] hover:bg-white"
          >
            Voir les forfaits
          </Link>
        </div>
      </section>
    </div>
  );
}
