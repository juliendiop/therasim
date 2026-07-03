// Chargement du contenu du blog (content/blog/*.mdx). Lecture filesystem, pas
// de base de données — le contenu est versionné dans le repo (voir plan).
import "server-only";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { postFrontmatterSchema, type PostFrontmatter, type Audience } from "./schema";

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

export type Post = {
  frontmatter: PostFrontmatter;
  /** Corps MDX brut, frontmatter déjà retiré. */
  content: string;
  filename: string;
};

function readPostFile(filename: string): Post {
  const raw = fs.readFileSync(path.join(BLOG_DIR, filename), "utf-8");
  const { data, content } = matter(raw);
  const parsed = postFrontmatterSchema.safeParse(data);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(racine)"} : ${issue.message}`)
      .join("\n");
    throw new Error(`Frontmatter invalide dans content/blog/${filename} :\n${details}`);
  }
  return { frontmatter: parsed.data, content, filename };
}

let cache: Post[] | null = null;

function readAllPostFiles(): Post[] {
  if (cache) return cache;
  if (!fs.existsSync(BLOG_DIR)) {
    cache = [];
    return cache;
  }
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".mdx"));
  const posts = files.map(readPostFile);
  posts.sort((a, b) => b.frontmatter.date.getTime() - a.frontmatter.date.getTime());
  cache = posts;
  return posts;
}

/** Tous les articles, triés du plus récent au plus ancien. Drafts exclus par défaut. */
export function getAllPosts({ includeDrafts = false }: { includeDrafts?: boolean } = {}): Post[] {
  const all = readAllPostFiles();
  return includeDrafts ? all : all.filter((p) => !p.frontmatter.draft);
}

/** Un article par slug, publié OU draft (accès direct par URL en préversion). */
export function getPostBySlug(slug: string): Post | null {
  return readAllPostFiles().find((p) => p.frontmatter.slug === slug) ?? null;
}

/** Filtre par audience : "les-deux" est inclus dans tout filtre spécifique. */
export function filterByAudience(posts: Post[], audience: Audience | "toutes"): Post[] {
  if (audience === "toutes") return posts;
  return posts.filter(
    (p) => p.frontmatter.audience === audience || p.frontmatter.audience === "les-deux",
  );
}

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type Heading = { depth: 2 | 3; text: string; slug: string };

/**
 * Titres h2/h3 extraits du Markdown SOURCE (avant compilation MDX), pour
 * construire la table des matières. Ignore les blocs de code (évite qu'un
 * "## commentaire" dans un exemple de code soit pris pour un vrai titre).
 */
export function extractHeadings(raw: string): Heading[] {
  const headings: Heading[] = [];
  let inCodeBlock = false;
  for (const line of raw.split("\n")) {
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;
    const m = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    const depth = m[1].length as 2 | 3;
    const text = m[2].replace(/[*_`]/g, "");
    headings.push({ depth, text, slug: slugify(text) });
  }
  return headings;
}

const WORDS_PER_MINUTE = 200;

/** Temps de lecture estimé (minutes), à partir du Markdown source. */
export function readingTime(raw: string): number {
  const plain = raw
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*_`>-]/g, " ");
  const words = plain.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
