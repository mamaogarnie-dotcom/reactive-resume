CREATE TABLE "cvmate_ai_usage" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"cv_build_id" text,
	"job_offer_id" text,
	"ai_provider_id" text,
	"operation" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"cached_input_tokens" integer,
	"total_tokens" integer,
	"usage_snapshot" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cvmate_ai_usage_provider_not_blank" CHECK (btrim("provider") <> ''),
	CONSTRAINT "cvmate_ai_usage_model_not_blank" CHECK (btrim("model") <> ''),
	CONSTRAINT "cvmate_ai_usage_input_tokens_nonnegative" CHECK ("input_tokens" IS NULL OR "input_tokens" >= 0),
	CONSTRAINT "cvmate_ai_usage_output_tokens_nonnegative" CHECK ("output_tokens" IS NULL OR "output_tokens" >= 0),
	CONSTRAINT "cvmate_ai_usage_cached_input_tokens_nonnegative" CHECK ("cached_input_tokens" IS NULL OR "cached_input_tokens" >= 0),
	CONSTRAINT "cvmate_ai_usage_total_tokens_nonnegative" CHECK ("total_tokens" IS NULL OR "total_tokens" >= 0)
);
--> statement-breakpoint
CREATE INDEX "cvmate_ai_usage_user_id_created_at_index" ON "cvmate_ai_usage" ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "cvmate_ai_usage_cv_build_id_created_at_index" ON "cvmate_ai_usage" ("cv_build_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "cvmate_ai_usage_job_offer_id_created_at_index" ON "cvmate_ai_usage" ("job_offer_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "cvmate_ai_usage_operation_created_at_index" ON "cvmate_ai_usage" ("operation","created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "cvmate_ai_usage" ADD CONSTRAINT "cvmate_ai_usage_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cvmate_ai_usage" ADD CONSTRAINT "cvmate_ai_usage_cv_build_id_cvmate_cv_build_id_fkey" FOREIGN KEY ("cv_build_id") REFERENCES "cvmate_cv_build"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "cvmate_ai_usage" ADD CONSTRAINT "cvmate_ai_usage_job_offer_id_cvmate_job_offer_id_fkey" FOREIGN KEY ("job_offer_id") REFERENCES "cvmate_job_offer"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "cvmate_ai_usage" ADD CONSTRAINT "cvmate_ai_usage_ai_provider_id_ai_providers_id_fkey" FOREIGN KEY ("ai_provider_id") REFERENCES "ai_providers"("id") ON DELETE SET NULL;