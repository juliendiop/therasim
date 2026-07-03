// Schéma de frontmatter du blog (content/blog/*.mdx). Validé à chaque lecture
// (build ET dev) — un frontmatter invalide fait échouer `next build` avec un
// message lisible (voir posts.ts), pas une stack ZodError brute.
import { z } from "zod";

export const AUDIENCES = ["praticien", "ecole", "les-deux"] as const;
export type Audience = (typeof AUDIENCES)[number];

export const AUDIENCE_LABEL: Record<Audience, string> = {
  praticien: "Thérapeutes & coachs",
  ecole: "Écoles & organismes",
  "les-deux": "Tous publics",
};

export const postFrontmatterSchema = z.object({
  title: z.string().min(1, "titre requis"),
  // 150-160 caractères : contrainte SEO (meta description) volontairement stricte.
  description: z
    .string()
    .min(150, "doit faire au moins 150 caractères (SEO)")
    .max(160, "doit faire au plus 160 caractères (SEO)"),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "doit être en kebab-case (ex. mon-article)"),
  date: z.coerce.date(),
  updated: z.coerce.date().optional(),
  keywords: z.array(z.string()).default([]),
  audience: z.enum(AUDIENCES),
  draft: z.boolean().default(false),
  cover: z.string().optional(),
});

export type PostFrontmatter = z.infer<typeof postFrontmatterSchema>;
