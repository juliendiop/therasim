import type { Metadata } from "next";
import { Quote } from "lucide-react";
import { requireUser } from "@/lib/auth";
import TemoignageForm from "@/app/beta/temoignage/temoignage-form";
import { submitAvisAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Laisser un avis — MELETA",
};

export default async function AvisPage() {
  await requireUser();

  return (
    <div className="animate-in mx-auto max-w-lg py-4 sm:py-8">
      <div className="card-soft p-6 sm:p-8">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <Quote className="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight sm:text-2xl">
          Partager votre avis sur MELETA
        </h1>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          Vous vous entraînez sur MELETA ? Votre retour aide d&apos;autres praticiens à se
          lancer. Complétez ces trois phrases et choisissez comment vous souhaitez être
          présenté — rien n&apos;est publié sans votre accord.
        </p>

        <TemoignageForm action={submitAvisAction} />
      </div>
    </div>
  );
}
