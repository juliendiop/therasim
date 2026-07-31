-- Relance J+2 « sans activité » : marqueur d'unique traitement par le cron.
-- Ajout purement additif (colonne nullable), aucune ligne existante impactée.
ALTER TABLE "beta_invites" ADD COLUMN "nudge_email_at" TIMESTAMP(3);
