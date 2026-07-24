import { Star } from "lucide-react";
import { listPublishedTestimonials, testimonialAttribution } from "@/lib/beta-bilan";

/**
 * Section publique des témoignages VALIDÉS. Ne rend rien tant qu'aucun témoignage
 * n'est publié — la section apparaît donc automatiquement dès qu'il y en a.
 */
export default async function TestimonialsSection() {
  const testimonials = await listPublishedTestimonials();
  if (testimonials.length === 0) return null;

  return (
    <section className="mx-auto max-w-5xl px-4 py-14 sm:py-20">
      <div className="text-center">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Ce qu&apos;en disent les praticiens
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Des retours de thérapeutes, coachs et étudiants qui se sont entraînés sur MELETA.
        </p>
      </div>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {testimonials.map((t) => (
          <li
            key={t.id}
            className="flex flex-col rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm"
          >
            <div className="flex gap-0.5" aria-label="5 étoiles sur 5">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <blockquote className="mt-3 flex-1 space-y-1.5 text-sm text-[var(--ink-soft)]">
              {t.beforeText.trim() && (
                <p>
                  <span className="text-[var(--muted)]">Avant MELETA, je</span> {t.beforeText}
                </p>
              )}
              {t.duringText.trim() && (
                <p>
                  <span className="text-[var(--muted)]">En utilisant MELETA, j&apos;ai</span>{" "}
                  {t.duringText}
                </p>
              )}
              {t.afterText.trim() && (
                <p>
                  <span className="text-[var(--muted)]">Aujourd&apos;hui, je</span> {t.afterText}
                </p>
              )}
            </blockquote>
            <p className="mt-4 text-sm font-semibold text-[var(--foreground)]">
              {testimonialAttribution(t)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
