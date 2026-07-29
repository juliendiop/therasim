import Link from "next/link";
import { ArrowLeft, Clock, GraduationCap } from "lucide-react";
import DemoRequestForm from "./demo-form";

export const dynamic = "force-dynamic";

export default function DemandeDemo() {
  return (
    <div className="mx-auto mt-8 max-w-md animate-in">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-4 w-4" /> Retour à l&apos;accueil
      </Link>

      <div className="mt-4 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent)] text-white shadow-md mx-auto">
          <GraduationCap className="h-6 w-6" />
        </span>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">
          Demander une démo
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Pour les écoles et organismes de formation. Nous organisons avec vous une
          présentation adaptée à vos apprenants.
        </p>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium text-[var(--accent)]">
          <Clock className="h-3.5 w-3.5" /> Réponse sous 2 jours ouvrés
        </p>
      </div>

      <div className="mt-6">
        <DemoRequestForm />
      </div>
    </div>
  );
}
