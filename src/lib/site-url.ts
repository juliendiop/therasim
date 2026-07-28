/**
 * URL de base CANONIQUE, résolue depuis l'environnement (utilisable au build, sans
 * requête). On rejette toute valeur locale ou `*.vercel.app` : le canonique doit
 * toujours pointer sur meleta.app, jamais sur une URL de déploiement.
 */
export function canonicalBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.APP_BASE_URL ?? "")
    .trim()
    .replace(/\/+$/, "");
  if (
    !raw ||
    raw.includes("localhost") ||
    raw.includes("127.0.0.1") ||
    raw.includes(".vercel.app")
  ) {
    return "https://meleta.app";
  }
  return raw;
}
