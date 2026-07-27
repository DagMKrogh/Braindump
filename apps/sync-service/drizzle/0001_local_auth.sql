ALTER TABLE "users" ALTER COLUMN "google_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;
