-- CreateTable
CREATE TABLE "llm_calls" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usage" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cache_creation_tokens" INTEGER NOT NULL DEFAULT 0,
    "cache_read_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_eur" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "user_id" UUID,
    "tenant_id" UUID,
    "framework_id" TEXT,
    "sim_session_id" UUID,
    "niveau" TEXT,
    "credits_debites" INTEGER,
    "duree_ms" INTEGER NOT NULL,
    "statut" TEXT NOT NULL,
    "erreur" TEXT,

    CONSTRAINT "llm_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_alerts" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "subject_key" TEXT NOT NULL,
    "window_key" TEXT NOT NULL,
    "amount_eur" DOUBLE PRECISION NOT NULL,
    "threshold_eur" DOUBLE PRECISION NOT NULL,
    "notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "llm_calls_created_at_idx" ON "llm_calls"("created_at");

-- CreateIndex
CREATE INDEX "llm_calls_user_id_created_at_idx" ON "llm_calls"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "llm_calls_usage_created_at_idx" ON "llm_calls"("usage", "created_at");

-- CreateIndex
CREATE INDEX "llm_calls_sim_session_id_idx" ON "llm_calls"("sim_session_id");

-- CreateIndex
CREATE INDEX "cost_alerts_created_at_idx" ON "cost_alerts"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "cost_alerts_kind_subject_key_window_key_key" ON "cost_alerts"("kind", "subject_key", "window_key");

