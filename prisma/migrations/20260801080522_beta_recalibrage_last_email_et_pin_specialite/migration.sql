-- AlterTable
ALTER TABLE "user_framework_access" ADD COLUMN     "pinned_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_beta_email_at" TIMESTAMP(3);

