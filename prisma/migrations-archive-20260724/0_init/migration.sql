-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "app_config" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_config_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'whitelabel',
    "statut" TEXT NOT NULL DEFAULT 'actif',
    "brand_name" TEXT,
    "logo_url" TEXT,
    "color_primary" TEXT,
    "allow_individual_offers" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'learner',
    "password_hash" TEXT,
    "consent_at" TIMESTAMP(3),
    "credits" INTEGER NOT NULL DEFAULT 0,
    "credits_refreshed_at" TIMESTAMP(3),
    "stripe_customer_id" TEXT,
    "referral_code" TEXT,
    "referred_by_user_id" UUID,
    "ambassador_at" TIMESTAMP(3),
    "ambassador_terms_at" TIMESTAMP(3),
    "is_beta_tester" BOOLEAN NOT NULL DEFAULT false,
    "beta_cohort" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "user_id" UUID,
    "email" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funnel_events" (
    "id" UUID NOT NULL,
    "visitor_id" TEXT NOT NULL,
    "user_id" UUID,
    "event" TEXT NOT NULL,
    "path" TEXT,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "funnel_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_ledger" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "delta" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stripe_subscription_id" TEXT,
    "period_index" INTEGER,

    CONSTRAINT "credit_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "monthly_credits" INTEGER NOT NULL,
    "framework_quota" INTEGER,
    "price_eur_cents" INTEGER NOT NULL,
    "stripe_price_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "stripe_subscription_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "period_anchor_at" TIMESTAMP(3),
    "trial_ends_at" TIMESTAMP(3),
    "mid_trial_email_at" TIMESTAMP(3),
    "trial_end_email_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "framework_offers" (
    "framework_id" TEXT NOT NULL,
    "price_eur_cents" INTEGER NOT NULL,
    "stripe_price_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "framework_offers_pkey" PRIMARY KEY ("framework_id")
);

-- CreateTable
CREATE TABLE "user_framework_access" (
    "user_id" UUID NOT NULL,
    "framework_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_framework_access_pkey" PRIMARY KEY ("user_id","framework_id")
);

-- CreateTable
CREATE TABLE "stripe_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_ledger" (
    "id" UUID NOT NULL,
    "beneficiary_id" UUID NOT NULL,
    "delta" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "tier" INTEGER,
    "source_user_id" UUID,
    "stripe_invoice_id" TEXT,
    "payout_request_id" UUID,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_requests" (
    "id" UUID NOT NULL,
    "ambassador_id" UUID NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "invoice_email_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payout_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packs" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pack_frameworks" (
    "pack_id" UUID NOT NULL,
    "framework_id" TEXT NOT NULL,

    CONSTRAINT "pack_frameworks_pkey" PRIMARY KEY ("pack_id","framework_id")
);

-- CreateTable
CREATE TABLE "tenant_packs" (
    "tenant_id" UUID NOT NULL,
    "pack_id" UUID NOT NULL,

    CONSTRAINT "tenant_packs_pkey" PRIMARY KEY ("tenant_id","pack_id")
);

-- CreateTable
CREATE TABLE "tenant_framework_overrides" (
    "tenant_id" UUID NOT NULL,
    "framework_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,

    CONSTRAINT "tenant_framework_overrides_pkey" PRIMARY KEY ("tenant_id","framework_id")
);

-- CreateTable
CREATE TABLE "frameworks" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "grid_id" TEXT NOT NULL,
    "description" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'brouillon',

    CONSTRAINT "frameworks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_grids" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,

    CONSTRAINT "competency_grids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "grid_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competencies" (
    "id" UUID NOT NULL,
    "grid_id" TEXT NOT NULL,
    "category_code" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "ancrage_1" TEXT,
    "ancrage_3" TEXT,
    "ancrage_5" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "competencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenarios" (
    "id" TEXT NOT NULL,
    "framework_id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "contexte" TEXT,

    CONSTRAINT "scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drills" (
    "id" TEXT NOT NULL,
    "framework_id" TEXT NOT NULL,
    "competency_id" TEXT NOT NULL,
    "scenario_context" TEXT,
    "difficulty" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "rappel_theorique" TEXT NOT NULL,
    "stimulus" TEXT NOT NULL,
    "options" JSONB,
    "patient_reaction_si_bon" TEXT,
    "modele_reponse" TEXT NOT NULL,

    CONSTRAINT "drills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "framework_id" TEXT NOT NULL,
    "competency_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "source_ref" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sim_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "framework_id" TEXT NOT NULL,
    "scenario_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'simulation',
    "max_turns" INTEGER,
    "focus" JSONB,
    "statut" TEXT NOT NULL DEFAULT 'en_cours',
    "debrief" JSONB,
    "self_assessment" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "sim_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sim_messages" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "turn" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sim_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "formations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formation_modules" (
    "id" UUID NOT NULL,
    "formation_id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "formation_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "titre" TEXT NOT NULL,
    "pairs" JSONB,
    "framework_id" TEXT,
    "competencies" JSONB,
    "drillIds" JSONB NOT NULL,
    "mode" TEXT NOT NULL,
    "duration_min" INTEGER NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'brouillon',
    "opens_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "closes_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_participants" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "prenom" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "live_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_answers" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "participant_id" UUID NOT NULL,
    "drill_id" TEXT NOT NULL,
    "framework_id" TEXT,
    "competency_id" TEXT NOT NULL,
    "option_index" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supervisor_notes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "session_id" UUID,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supervisor_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_competency_state" (
    "user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "framework_id" TEXT NOT NULL,
    "competency_id" TEXT NOT NULL,
    "mastery" DOUBLE PRECISION,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_practiced" TIMESTAMP(3),

    CONSTRAINT "user_competency_state_pkey" PRIMARY KEY ("user_id","framework_id","competency_id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "context" JSONB,
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_message_from" TEXT NOT NULL DEFAULT 'client',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "author_role" TEXT NOT NULL,
    "author_id" UUID,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_hits" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limit_hits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beta_invites" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "email" TEXT,
    "note" TEXT,
    "cohort" TEXT NOT NULL DEFAULT 'beta-2026-01',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "claimed_by_user_id" UUID,
    "claimed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "stripe_subscription_id" TEXT,
    "email_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beta_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_referral_code_key" ON "users"("referral_code");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE INDEX "users_referred_by_user_id_idx" ON "users"("referred_by_user_id");

-- CreateIndex
CREATE INDEX "audit_events_tenant_id_idx" ON "audit_events"("tenant_id");

-- CreateIndex
CREATE INDEX "audit_events_created_at_idx" ON "audit_events"("created_at");

-- CreateIndex
CREATE INDEX "funnel_events_event_created_at_idx" ON "funnel_events"("event", "created_at");

-- CreateIndex
CREATE INDEX "funnel_events_visitor_id_idx" ON "funnel_events"("visitor_id");

-- CreateIndex
CREATE INDEX "funnel_events_user_id_idx" ON "funnel_events"("user_id");

-- CreateIndex
CREATE INDEX "credit_ledger_user_id_idx" ON "credit_ledger"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_ledger_stripe_subscription_id_reason_period_index_key" ON "credit_ledger"("stripe_subscription_id", "reason", "period_index");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_key_key" ON "subscription_plans"("key");

-- CreateIndex
CREATE UNIQUE INDEX "user_subscriptions_user_id_key" ON "user_subscriptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_subscriptions_stripe_subscription_id_key" ON "user_subscriptions"("stripe_subscription_id");

-- CreateIndex
CREATE INDEX "commission_ledger_beneficiary_id_created_at_idx" ON "commission_ledger"("beneficiary_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "commission_ledger_beneficiary_id_stripe_invoice_id_tier_key" ON "commission_ledger"("beneficiary_id", "stripe_invoice_id", "tier");

-- CreateIndex
CREATE INDEX "payout_requests_status_created_at_idx" ON "payout_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "payout_requests_ambassador_id_idx" ON "payout_requests"("ambassador_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_tokens_token_key" ON "auth_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "packs_slug_key" ON "packs"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "categories_grid_id_code_key" ON "categories"("grid_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "competencies_grid_id_code_key" ON "competencies"("grid_id", "code");

-- CreateIndex
CREATE INDEX "drills_framework_id_competency_id_idx" ON "drills"("framework_id", "competency_id");

-- CreateIndex
CREATE INDEX "attempts_user_id_framework_id_competency_id_idx" ON "attempts"("user_id", "framework_id", "competency_id");

-- CreateIndex
CREATE INDEX "sim_sessions_user_id_framework_id_idx" ON "sim_sessions"("user_id", "framework_id");

-- CreateIndex
CREATE INDEX "sim_messages_session_id_idx" ON "sim_messages"("session_id");

-- CreateIndex
CREATE INDEX "formations_tenant_id_idx" ON "formations"("tenant_id");

-- CreateIndex
CREATE INDEX "formation_modules_formation_id_idx" ON "formation_modules"("formation_id");

-- CreateIndex
CREATE INDEX "live_sessions_tenant_id_idx" ON "live_sessions"("tenant_id");

-- CreateIndex
CREATE INDEX "live_participants_session_id_idx" ON "live_participants"("session_id");

-- CreateIndex
CREATE INDEX "live_answers_session_id_idx" ON "live_answers"("session_id");

-- CreateIndex
CREATE INDEX "live_answers_participant_id_idx" ON "live_answers"("participant_id");

-- CreateIndex
CREATE INDEX "supervisor_notes_tenant_id_learner_id_idx" ON "supervisor_notes"("tenant_id", "learner_id");

-- CreateIndex
CREATE INDEX "support_tickets_user_id_last_message_at_idx" ON "support_tickets"("user_id", "last_message_at");

-- CreateIndex
CREATE INDEX "support_tickets_status_last_message_at_idx" ON "support_tickets"("status", "last_message_at");

-- CreateIndex
CREATE INDEX "support_messages_ticket_id_created_at_idx" ON "support_messages"("ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "rate_limit_hits_key_created_at_idx" ON "rate_limit_hits"("key", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "beta_invites_code_key" ON "beta_invites"("code");

-- CreateIndex
CREATE INDEX "beta_invites_status_idx" ON "beta_invites"("status");

-- CreateIndex
CREATE INDEX "beta_invites_claimed_by_user_id_idx" ON "beta_invites"("claimed_by_user_id");

-- CreateIndex
CREATE INDEX "beta_invites_cohort_idx" ON "beta_invites"("cohort");

