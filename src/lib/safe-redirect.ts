// Validation d'un chemin de retour après authentification — module PUR.
//
// Sans cette garde, un `?next=` est une faille d'open redirect classique :
// /login?next=https://phishing.example imiterait une redirection légitime de
// MELETA vers un site tiers, après une connexion réussie.

/**
 * Caractères de contrôle (NUL, CR/LF…) : vecteur d'injection d'en-tête.
 * Testé par code de caractère plutôt que par regex : une classe de caractères
 * contenant des octets de contrôle LITTÉRAUX est illisible et se fait silencieusement
 * corrompre par les éditeurs ou un copier-coller.
 */
function hasControlChars(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c <= 0x1f || c === 0x7f) return true;
  }
  return false;
}

/**
 * Renvoie le chemin s'il est un chemin INTERNE sûr, sinon null.
 * N'accepte qu'un chemin relatif à la racine : pas d'URL absolue, pas de
 * protocol-relative (`//evil.com`), pas d'antislash (que certains navigateurs
 * normalisent en `/`), pas de caractère de contrôle.
 */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const path = value.trim();
  if (path.length === 0 || path.length > 512) return null;
  if (!path.startsWith("/")) return null; // exclut http://, https://, javascript:…
  if (path.startsWith("//")) return null; // protocol-relative -> domaine externe
  if (path.includes("\\")) return null;
  if (hasControlChars(path)) return null;
  return path;
}
