import "server-only";
import { headers } from "next/headers";

/**
 * URL publique de base pour construire les liens partagés (liens magiques,
 * réinitialisation de mot de passe, invitations, emails d'offre).
 *
 * Priorité :
 *  1. APP_BASE_URL non-localhost → réglage explicite (à poser sur Vercel quand le
 *     domaine custom est raccordé, pour des liens stables).
 *  2. Origine de la requête → le domaine sur lequel l'utilisateur navigue VRAIMENT,
 *     donc toujours joignable. Évite les liens morts quand le domaine de production
 *     déclaré sur Vercel (ex. meleta.app) n'est pas encore raccordé (DNS en attente).
 *  3. VERCEL_PROJECT_PRODUCTION_URL → contextes sans requête (cron, scripts).
 *  4. APP_BASE_URL (localhost) → développement local.
 *  5. http://localhost:3000 en dernier recours.
 *
 * Note : sur un déploiement de PREVIEW Vercel, l'origine de la requête est l'URL de
 * preview (protégée par l'authentification Vercel) — les liens envoyés à des tiers
 * depuis une preview afficheront un mur de connexion. En production, aucun impact.
 */
export function appBaseUrl(requestOrigin?: string): string {
  const clean = (u: string) => u.trim().replace(/\/+$/, "");
  const explicit = process.env.APP_BASE_URL?.trim();

  if (explicit && !explicit.includes("localhost")) return clean(explicit);

  if (requestOrigin && !requestOrigin.includes("localhost")) return clean(requestOrigin);

  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prod) return `https://${clean(prod)}`;

  if (explicit) return clean(explicit); // localhost en dev
  return clean(requestOrigin ?? "http://localhost:3000");
}

/**
 * Ramène une URL de déploiement Vercel vers l'alias stable du projet.
 * Les URLs générées par déploiement (ex. therasim-28zp0srwk-mon-equipe-projects
 * .vercel.app, ou therasim-git-main-....vercel.app) sont protégées par
 * l'authentification Vercel : un lien envoyé par email vers ces adresses affiche
 * un mur de connexion Vercel aux destinataires. L'alias projet.vercel.app, lui,
 * est public.
 */
function stableVercelHost(host: string): string {
  if (!host.endsWith(".vercel.app")) return host;
  // URL de branche : <projet>-git-<branche>-<equipe>.vercel.app
  const git = host.match(/^(.+?)-git-[a-z0-9-]+\.vercel\.app$/);
  if (git) return `${git[1]}.vercel.app`;
  // URL de déploiement unique : <projet>-<hash>-<equipe>.vercel.app
  const dep = host.match(/^(.+?)-[a-z0-9]{7,}-[a-z0-9-]+\.vercel\.app$/);
  if (dep) return `${dep[1]}.vercel.app`;
  return host;
}

/**
 * Variante pour Route Handlers et Server Actions : reconstruit l'origine depuis les
 * en-têtes de la requête courante (x-forwarded-host/proto posés par Vercel), plus
 * fiable que req.nextUrl.origin derrière un proxy.
 */
export async function appBaseUrlFromRequest(): Promise<string> {
  const h = await headers();
  const rawHost = h.get("x-forwarded-host") ?? h.get("host");
  if (!rawHost) return appBaseUrl();
  const host = stableVercelHost(rawHost);
  const proto =
    h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return appBaseUrl(`${proto}://${host}`);
}
