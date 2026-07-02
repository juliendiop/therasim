// Identité visuelle des patients (cas fictifs) : nom affiché + avatar
// monogramme coloré, dérivés déterministement du titre du scénario — pas de
// génération d'image, pas de champ de données supplémentaire.

/** "Marc — ambivalence sur l'alcool" -> "Marc" · "Sylvie, 47 ans — ..." -> "Sylvie". */
export function patientDisplayName(titre: string): string {
  const beforeDash = titre.split(/[—-]/)[0]?.trim() ?? titre;
  const beforeComma = beforeDash.split(",")[0]?.trim();
  return beforeComma || titre;
}

const AVATAR_PALETTE: { bg: string; fg: string }[] = [
  { bg: "#0e5a54", fg: "#ffffff" }, // teal (accent)
  { bg: "#a8772a", fg: "#ffffff" }, // ochre
  { bg: "#3e8e86", fg: "#ffffff" }, // teal solide
  { bg: "#c26f5f", fg: "#ffffff" }, // terracotta
  { bg: "#6b5b95", fg: "#ffffff" }, // violet doux
  { bg: "#4a6fa5", fg: "#ffffff" }, // bleu ardoise
  { bg: "#7a8f5a", fg: "#ffffff" }, // vert olive
  { bg: "#b5651d", fg: "#ffffff" }, // brique
];

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

export function patientAvatarStyle(seed: string): { bg: string; fg: string } {
  return AVATAR_PALETTE[hashSeed(seed) % AVATAR_PALETTE.length];
}

export function patientInitials(name: string): string {
  const cleaned = name.replace(/^M\.\s*|^Mme\s*/i, "").trim();
  const letters = cleaned
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return letters || "?";
}
