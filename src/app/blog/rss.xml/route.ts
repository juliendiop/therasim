import { NextResponse } from "next/server";
import { getAllPosts } from "@/lib/blog/posts";
import { appBaseUrl } from "@/lib/base-url";

// SSG + revalidation : `appBaseUrl()` (sans argument, sans `headers()`) permet
// de générer ce flux de façon statique — pas de force-dynamic.
export const revalidate = 3600;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const base = appBaseUrl();
  const posts = getAllPosts(); // drafts déjà exclus par défaut

  const items = posts
    .map((p) => {
      const url = `${base}/blog/${p.frontmatter.slug}`;
      return `
    <item>
      <title>${escapeXml(p.frontmatter.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${p.frontmatter.date.toUTCString()}</pubDate>
      <description>${escapeXml(p.frontmatter.description)}</description>
    </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>MELETA — Blog</title>
    <link>${base}/blog</link>
    <description>Ressources sur l&apos;entraînement clinique par compétences.</description>
    <language>fr</language>${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
