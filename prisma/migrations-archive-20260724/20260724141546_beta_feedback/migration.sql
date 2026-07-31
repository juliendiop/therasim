-- Questionnaire « impression à chaud » de la bêta + marqueur d'envoi de la relance.
-- Ajouts purement additifs (colonne nullable + nouvelle table), aucune ligne existante impactée.
ALTER TABLE "beta_invites" ADD COLUMN "feedback_email_at" TIMESTAMP(3);

CREATE TABLE "beta_feedback" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "cohort" TEXT,
    "q1" TEXT NOT NULL,
    "q2" TEXT NOT NULL,
    "q3" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beta_feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "beta_feedback_created_at_idx" ON "beta_feedback"("created_at");
CREATE INDEX "beta_feedback_user_id_idx" ON "beta_feedback"("user_id");
