import type { MetadataRoute } from "next";

/**
 * Même résolution canonique que le sitemap : jamais d'URL `*.vercel.app` ni
 * locale, repli sur meleta.app.
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

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Zones privées / techniques : API, admin, espace applicatif authentifié,
      // pages d'auth et parcours bêta (avec codes d'invitation). Inutile de
      // gaspiller le budget de crawl sur des pages qui redirigent vers /login.
      disallow: [
        "/api/",
        "/admin/",
        "/beta/",
        "/accueil",
        "/sessions",
        "/sim/",
        "/drills/",
        "/live/",
        "/f/",
        "/catalogue",
        "/formations",
        "/supervision",
        "/gestion",
        "/historique",
        "/credits",
        "/support",
        "/affiliation",
        "/avis",
        "/login",
        "/inscription",
        "/reset-password",
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
