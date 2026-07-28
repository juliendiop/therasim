import Link from "next/link";
import { ArrowRight, Dumbbell, MessagesSquare } from "lucide-react";
import type { DomaineCard } from "@/lib/catalogue";
import { TYPE_LABEL } from "@/lib/ui";

/**
 * Carte publique d'un référentiel (page /domaines et section accueil). Compteurs et
 * libellés viennent tous de la base — rien codé en dur. Lien vers /domaines/[slug].
 */
export default function DomaineCardView({ card }: { card: DomaineCard }) {
  const socle = card.nature === "socle";
  return (
    <Link
      href={`/domaines/${card.slug}`}
      className="group flex flex-col rounded-2xl border border-[var(--border)] bg-white p-5 transition hover:border-[var(--accent)] hover:shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--accent)]">
          {TYPE_LABEL[card.type] ?? card.type}
        </span>
        {socle && (
          <span className="rounded-full bg-[var(--ochre-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--ochre)]">
            Socle
          </span>
        )}
      </div>
      <h3 className="mt-3 text-lg font-semibold group-hover:text-[var(--accent)]">{card.nom}</h3>
      {card.description && (
        <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">{card.description}</p>
      )}
      <div className="mt-4 flex items-center gap-4 text-xs text-[var(--muted)]">
        <span className="inline-flex items-center gap-1">
          <Dumbbell className="h-3.5 w-3.5 text-[var(--accent)]" />
          {card.competencyCount} compétence{card.competencyCount > 1 ? "s" : ""}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessagesSquare className="h-3.5 w-3.5 text-[var(--accent)]" />
          {card.casCount} cas jouable{card.casCount > 1 ? "s" : ""}
        </span>
        <ArrowRight className="ml-auto h-4 w-4 transition group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
      </div>
    </Link>
  );
}
