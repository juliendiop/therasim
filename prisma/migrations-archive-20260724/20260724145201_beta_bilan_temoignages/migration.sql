-- Bilan de fin de phase active (J+21) + témoignages des promoteurs (NPS 8-10).
-- Ajouts purement additifs (colonnes nullables + nouvelles tables).

ALTER TABLE "beta_invites" ADD COLUMN "bilan_email_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "testimonial_invite_at" TIMESTAMP(3);

CREATE TABLE "beta_bilan" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "cohort" TEXT,
    "q1" TEXT NOT NULL,
    "q2" TEXT NOT NULL,
    "q3" TEXT NOT NULL,
    "q4" TEXT NOT NULL,
    "nps" INTEGER NOT NULL,
    "nps_why" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beta_bilan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "beta_bilan_created_at_idx" ON "beta_bilan"("created_at");
CREATE INDEX "beta_bilan_user_id_idx" ON "beta_bilan"("user_id");
CREATE INDEX "beta_bilan_nps_idx" ON "beta_bilan"("nps");

CREATE TABLE "testimonials" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "before_text" TEXT NOT NULL,
    "during_text" TEXT NOT NULL,
    "after_text" TEXT NOT NULL,
    "display_mode" TEXT NOT NULL,
    "first_name" TEXT,
    "profession" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "testimonials_status_created_at_idx" ON "testimonials"("status", "created_at");
CREATE INDEX "testimonials_user_id_idx" ON "testimonials"("user_id");
