// Calcul de période d'abonnement — module PUR (aucune dépendance serveur, testable
// directement). Utilisé par le chemin webhook ET par le rechargement paresseux :
// les deux DOIVENT converger sur le même entier pour la même période.
//
// ⚠️ Le `periodIndex` est RELATIF À L'ANCRE de l'abonnement, jamais au mois
// calendaire. Un abonnement ancré le 28 (ou le 31) chevauche deux mois civils :
// une clé calendaire dupliquerait ou refuserait des octrois de façon aléatoire.

/**
 * Ajoute `n` mois à une date en bornant le jour au dernier jour du mois cible,
 * comme le fait Stripe (31 janvier + 1 mois = 28/29 février). Tout en UTC.
 */
export function addMonthsClamped(date: Date, n: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  const targetMonthStart = Date.UTC(year, month + n, 1);
  const t = new Date(targetMonthStart);
  // Jour 0 du mois suivant = dernier jour du mois cible.
  const lastDay = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();

  return new Date(
    Date.UTC(
      t.getUTCFullYear(),
      t.getUTCMonth(),
      Math.min(day, lastDay),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

/**
 * Index de période : nombre de mois d'abonnement RÉVOLUS depuis l'ancre.
 * La période initiale vaut 0, la suivante 1, etc. Jamais négatif.
 *
 * Déterministe : deux appels avec la même ancre et la même date donnent le même
 * entier, quel que soit le chemin d'appel (webhook ou paresseux).
 */
export function periodIndexFor(anchor: Date, at: Date): number {
  if (at.getTime() < anchor.getTime()) return 0;

  // Estimation par différence de mois civils, puis correction d'un cran si la
  // date de bascule (ancre + n mois, jour borné) n'est pas encore atteinte.
  let months =
    (at.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
    (at.getUTCMonth() - anchor.getUTCMonth());
  if (months < 0) return 0;
  if (addMonthsClamped(anchor, months).getTime() > at.getTime()) months -= 1;
  return Math.max(0, months);
}

/** Date de début de la période `index` (utile pour l'affichage et les emails). */
export function periodStart(anchor: Date, index: number): Date {
  return addMonthsClamped(anchor, index);
}
