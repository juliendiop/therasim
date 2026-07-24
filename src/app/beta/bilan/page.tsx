import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import BilanForm from "./bilan-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Votre bilan — MELETA",
  robots: { index: false, follow: false },
};

export default async function BetaBilanPage() {
  await requireUser();

  return (
    <div className="animate-in mx-auto max-w-lg py-4 sm:py-8">
      <div className="card-soft p-6 sm:p-8">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <ClipboardCheck className="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight sm:text-2xl">
          Votre bilan de la phase pilote
        </h1>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          Quatre minutes pour un retour qui pèse directement sur les prochaines évolutions.
          Soyez franc — c&apos;est ce qui m&apos;est le plus utile.
        </p>

        <BilanForm />
      </div>
    </div>
  );
}
