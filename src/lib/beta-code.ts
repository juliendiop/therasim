// Génération et normalisation des codes d'invitation bêta — module PUR
// (importable depuis un script tsx comme depuis l'app).
//
// Pas de `nanoid` : `node:crypto` est déjà utilisé dans src/lib/auth.ts et offre la
// même garantie d'entropie sans dépendance supplémentaire.

import { randomBytes } from "node:crypto";

// Base32 sans ambiguïté : ni 0/O, ni 1/I/L. Lisible à l'oral et au téléphone,
// et robuste aux fautes de recopie depuis un email.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 31 caractères

/** 24 caractères sur 31 symboles ≈ 10^35 combinaisons : non brute-forçable. */
export const BETA_CODE_LENGTH = 24;

/**
 * Code aléatoire cryptographiquement sûr.
 * Rejection sampling : on écarte les octets ≥ 248 (= 31 × 8) pour éviter le biais
 * modulo qui rendrait certains caractères plus probables que d'autres.
 */
export function generateBetaCode(length: number = BETA_CODE_LENGTH): string {
  const n = ALPHABET.length;
  const threshold = Math.floor(256 / n) * n; // 248
  let out = "";
  while (out.length < length) {
    for (const b of randomBytes(length)) {
      if (b >= threshold) continue; // biais écarté
      out += ALPHABET[b % n];
      if (out.length === length) break;
    }
  }
  return out;
}

/**
 * Normalise un code saisi ou collé depuis un email : majuscules, espaces et
 * tirets de mise en forme retirés. Ne corrige PAS les confusions de caractères
 * (l'alphabet les rend impossibles par construction).
 */
export function normalizeBetaCode(input: string): string {
  return input.trim().toUpperCase().replace(/[\s-]/g, "");
}

/** Forme attendue d'un code (garde peu coûteuse avant toute requête base). */
export function isPlausibleBetaCode(input: string): boolean {
  const code = normalizeBetaCode(input);
  if (code.length !== BETA_CODE_LENGTH) return false;
  for (const ch of code) if (!ALPHABET.includes(ch)) return false;
  return true;
}
