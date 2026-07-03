// Composants MDX custom pour le blog, rendus entièrement côté serveur (aucun
// JS client). Passés à compileMDX() (next-mdx-remote/rsc) dans /blog/[slug].
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { HelpCircle, Sparkles } from "lucide-react";
import { slugify } from "@/lib/blog/posts";

/** Dialogue clinique stylisé : réplique du patient ou du praticien. */
export function Verbatim({
  role,
  name,
  children,
}: {
  role: "patient" | "praticien";
  name?: string;
  children: ReactNode;
}) {
  const isPatient = role === "patient";
  return (
    <div className={`not-prose my-4 flex ${isPatient ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
          isPatient
            ? "border border-[var(--border)] bg-white"
            : "bg-[var(--accent)] text-white"
        }`}
      >
        <div
          className={`mb-1 text-[11px] font-medium ${
            isPatient ? "text-[var(--muted)]" : "text-white/80"
          }`}
        >
          {name ?? (isPatient ? "Le patient" : "Le praticien")}
        </div>
        <p className="italic">{children}</p>
      </div>
    </div>
  );
}

/** Encart "à retenir" — même langage visuel que le "Rappel" des drills. */
export function PointCle({ children }: { children: ReactNode }) {
  return (
    <div className="not-prose my-5 flex gap-3 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-4">
      <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]" />
      <div className="text-sm">
        <div className="font-semibold text-[var(--accent)]">Point clé</div>
        <div className="mt-0.5 text-[var(--ink-soft)]">{children}</div>
      </div>
    </div>
  );
}

/**
 * Une question de la FAQ : `<FaqItem q="...">réponse</FaqItem>`.
 * Nécessairement un enfant direct de <FAQ> — jamais utilisé isolément.
 * NB : `<FAQ items={[...]} />` (tableau en prop) a été essayé en premier mais
 * échoue silencieusement avec next-mdx-remote (le prop arrive `undefined` à
 * l'exécution — son évaluation runtime des props MDX ne gère pas correctement
 * les littéraux objet/tableau complexes). Les enfants imbriqués, motif MDX
 * natif, fonctionnent de façon fiable.
 */
export function FaqItem({ q, children }: { q: string; children: ReactNode }) {
  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold">{q}</h3>
      <p className="mt-1 text-sm text-[var(--muted)]">{children}</p>
    </div>
  );
}

type FaqItemElement = ReactElement<{ q: string; children?: ReactNode }>;

/** FAQ visuelle + données structurées schema.org FAQPage (même pattern que /tarifs). */
export function FAQ({ children }: { children: ReactNode }) {
  const items = Children.toArray(children).filter(
    (child): child is FaqItemElement => isValidElement(child),
  );
  return (
    <div className="not-prose my-6">
      <h2 className="flex items-center gap-1.5 text-lg font-semibold">
        <HelpCircle className="h-5 w-5 text-[var(--ochre)]" /> Questions fréquentes
      </h2>
      <div className="mt-3 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-white">
        {children}
      </div>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: items.map((item) => ({
              "@type": "Question",
              name: item.props.q,
              acceptedAnswer: { "@type": "Answer", text: textOf(item.props.children) },
            })),
          }),
        }}
      />
    </div>
  );
}

/** Texte brut d'un ReactNode (best-effort) — sert à dériver l'id des titres. */
function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

// h2/h3 posent id={slugify(texte)} : MÊME fonction slugify() que
// extractHeadings() (src/lib/blog/posts.ts) — garantit que les ancres de la
// table des matières correspondent exactement aux id réellement rendus.
export function H2({ children }: { children: ReactNode }) {
  return <h2 id={slugify(textOf(children))}>{children}</h2>;
}
export function H3({ children }: { children: ReactNode }) {
  return <h3 id={slugify(textOf(children))}>{children}</h3>;
}

export const mdxComponents = {
  Verbatim,
  PointCle,
  FAQ,
  FaqItem,
  h2: H2,
  h3: H3,
};
