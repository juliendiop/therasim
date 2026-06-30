import "server-only";

/**
 * URL publique de base pour construire les liens partagés (invitations, liens magiques).
 *
 * Priorité :
 *  1. APP_BASE_URL non-localhost  → réglage explicite (domaine custom / prod choisi).
 *  2. VERCEL_PROJECT_PRODUCTION_URL → domaine de PRODUCTION Vercel. On l'utilise pour
 *     éviter les URLs de déploiement (ex. ...-pupr3tnfn-...vercel.app) protégées par
 *     l'authentification Vercel, qui afficheraient un mur de connexion aux invités.
 *  3. APP_BASE_URL (localhost) → développement local.
 *  4. Origine de la requête en dernier recours.
 */
export function appBaseUrl(requestOrigin?: string): string {
  const clean = (u: string) => u.trim().replace(/\/+$/, "");
  const explicit = process.env.APP_BASE_URL?.trim();

  if (explicit && !explicit.includes("localhost")) return clean(explicit);

  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prod) return `https://${clean(prod)}`;

  if (explicit) return clean(explicit); // localhost en dev
  return clean(requestOrigin ?? "http://localhost:3000");
}
