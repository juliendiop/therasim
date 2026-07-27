import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/blog/posts";

// Régénère au plus toutes les heures. Le contenu (blog) étant versionné en
// fichiers, il change surtout au déploiement — mais ce revalidate évite un
// sitemap figé si le cache persistait entre deux builds.
export const revalidate = 3600;

/**
 * URL de base CANONIQUE du site. On préfère une variable d'env dédiée si elle
 * existe, sinon `APP_BASE_URL` — mais on rejette explicitement toute valeur
 * locale ou `*.vercel.app` : le sitemap doit toujours pointer sur le domaine
 * canonique meleta.app, jamais sur une URL de déploiement Vercel.
 */
function resolveBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.APP_BASE_URL ?? "").trim();
  const url = raw.replace(/\/+$/, "");
  if (
    !url ||
    url.includes("localhost") ||
    url.includes("127.0.0.1") ||
    url.includes(".vercel.app")
  ) {
    return "https://meleta.app";
  }
  return url;
}

const BASE_URL = resolveBaseUrl();

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // Pages publiques indexables (voir rapport : classées via requireUser()).
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/tarifs`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    {
      url: `${BASE_URL}/ambassadeurs`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/demande-demo`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];

  // Articles de blog PUBLIÉS uniquement (getAllPosts exclut les drafts, qui sont
  // en `noindex`). lastModified = vraie date de mise à jour du frontmatter, pour
  // que Googlebot détecte les révisions.
  const blogRoutes: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: `${BASE_URL}/blog/${post.frontmatter.slug}`,
    lastModified: post.frontmatter.updated ?? post.frontmatter.date,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...blogRoutes];
}
