import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { LEGAL_DISCLAIMER, LEGAL_UPDATED_AT } from "@/lib/legal";

/**
 * Gabarit commun aux pages légales : titre, bandeau « brouillon à faire relire »
 * (à retirer une fois la relecture juridique faite — voir src/lib/legal.ts), et
 * mise en forme typographique lisible pour du texte long.
 */
export default function LegalPage({
  titre,
  chapeau,
  children,
}: {
  titre: string;
  chapeau?: string;
  children: ReactNode;
}) {
  return (
    <div className="animate-in mx-auto max-w-3xl">
      <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
        {titre}
      </h1>
      {chapeau && <p className="mt-3 text-base text-[var(--ink-soft)]">{chapeau}</p>}

      <div className="mt-6 flex gap-3 rounded-xl border border-[var(--ochre)] bg-[var(--ochre-soft)] p-4">
        <AlertTriangle className="h-5 w-5 shrink-0 text-[var(--ochre)]" />
        <p className="text-sm text-[var(--ink-soft)]">
          <b>Brouillon — relecture juridique nécessaire.</b> {LEGAL_DISCLAIMER}
        </p>
      </div>

      <div className="legal-prose mt-8">{children}</div>

      <p className="mt-12 border-t border-[var(--border)] pt-4 text-xs text-[var(--muted)]">
        Dernière mise à jour : {LEGAL_UPDATED_AT}.
      </p>
    </div>
  );
}

/** Section de page légale : titre de niveau 2 ancré (permet un lien direct). */
export function LegalSection({
  id,
  titre,
  children,
}: {
  id: string;
  titre: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="mt-10 text-xl font-semibold tracking-tight first:mt-0">{titre}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

/** Bloc « information manquante » : rend visible ce qui reste à fournir. */
export function ToFill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-[var(--ochre-soft)] px-1.5 py-0.5 font-medium text-[var(--ochre)]">
      {children}
    </span>
  );
}
