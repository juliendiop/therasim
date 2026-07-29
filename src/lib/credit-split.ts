// Répartition PURE d'un débit de crédits (aucune dépendance serveur — testable seul).
//
// CONTRAT : on puise D'ABORD dans l'allocation d'abonnement (`planCredits`, périssable),
// PUIS dans le portefeuille persistant (`wallet` : packs achetés + crédits gratuits, sans
// péremption). C'est ce module que teste test/consumption-order.test.ts.

export type DebitSplit = { fromPlan: number; fromWallet: number };

export function splitDebit(planCredits: number, wallet: number, amount: number): DebitSplit {
  const fromPlan = Math.min(Math.max(0, planCredits), Math.max(0, amount));
  return { fromPlan, fromWallet: Math.max(0, amount) - fromPlan };
}
