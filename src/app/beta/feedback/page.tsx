import type { Metadata } from "next";
import { MessageSquareHeart } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import FeedbackForm from "./feedback-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Votre impression à chaud — MELETA",
  robots: { index: false, follow: false },
};

export default async function BetaFeedbackPage() {
  const user = await requireUser();
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { firstName: true },
  });

  return (
    <div className="animate-in mx-auto max-w-lg py-4 sm:py-8">
      <div className="card-soft p-6 sm:p-8">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <MessageSquareHeart className="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight sm:text-2xl">
          Votre impression à chaud
        </h1>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          Vous avez commencé à explorer MELETA. Avant que l&apos;habitude ne s&apos;installe,
          j&apos;aimerais recueillir votre impression spontanée — trois questions, deux minutes.
        </p>

        <FeedbackForm firstName={dbUser?.firstName ?? null} />
      </div>
    </div>
  );
}
