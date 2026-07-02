// Identité affichée d'un patient (cas fictif) : nom dérivé du titre du scénario.
// Safe pour le client (aucune dépendance serveur) — le portrait lui-même est
// généré côté serveur, voir src/lib/patient-avatar-svg.ts.

/** "Marc — ambivalence sur l'alcool" -> "Marc" · "Sylvie, 47 ans — ..." -> "Sylvie". */
export function patientDisplayName(titre: string): string {
  const beforeDash = titre.split(/[—-]/)[0]?.trim() ?? titre;
  const beforeComma = beforeDash.split(",")[0]?.trim();
  return beforeComma || titre;
}
