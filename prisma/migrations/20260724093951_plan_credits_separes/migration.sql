-- Compteur de crédits de forfait, séparé du portefeuille persistant.
--
-- `plan_credits` porte l'allocation de l'abonnement/essai pour la période EN COURS,
-- non cumulative (remise à la valeur du forfait chaque période, remise à 0 en fin
-- d'accès). Séparée de `credits` (packs achetés + crédits gratuits) pour ne jamais
-- confisquer un crédit payé. Ajout purement additif : colonne NOT NULL à 0 par
-- défaut, aucune ligne existante impactée.
ALTER TABLE "users" ADD COLUMN "plan_credits" INTEGER NOT NULL DEFAULT 0;
