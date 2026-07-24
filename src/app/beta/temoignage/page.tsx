import type { Metadata } from "next";
import { Quote } from "lucide-react";
import { requireUser } from "@/lib/auth";
import TemoignageForm from "./temoignage-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Votre témoignage — MELETA",
  robots: { index: false, follow: false },
};

export default async function BetaTemoignagePage() {
  await requireUser();

  return (
    <div className="animate-in mx-auto max-w-lg py-4 sm:py-8">
      <div className="card-soft p-6 sm:p-8">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <Quote className="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight sm:text-2xl">
          Partager votre témoignage
        </h1>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          Merci d&apos;avoir accepté. Complétez ces trois phrases, choisissez comment vous
          souhaitez être présenté — et rien ne sera publié sans votre accord.
        </p>

        <TemoignageForm />
      </div>
    </div>
  );
}
