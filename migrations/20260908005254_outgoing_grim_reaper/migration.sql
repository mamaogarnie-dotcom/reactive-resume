CREATE TABLE "cvmate_cv_build" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"master_profile_id" text,
	"job_offer_id" text,
	"current_step" text DEFAULT 'offer' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"target_language" text,
	"job_offer_snapshot" jsonb,
	"design_settings" jsonb,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cvmate_cv_gap" (
	"id" text PRIMARY KEY,
	"cv_build_id" text NOT NULL,
	"job_requirement_id" text,
	"requirement_text_snapshot" text,
	"text" text NOT NULL,
	"severity" text DEFAULT 'additional' NOT NULL,
	"origin" text DEFAULT 'detected' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution_source_type" text,
	"resolution_source_id" text,
	"resolution_text_snapshot" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cvmate_cv_generated_content" (
	"id" text PRIMARY KEY,
	"cv_build_id" text NOT NULL,
	"selection_item_id" text,
	"kind" text NOT NULL,
	"source_text" text,
	"source_data_snapshot" jsonb DEFAULT '{}' NOT NULL,
	"ai_text" text,
	"final_text" text,
	"model" text,
	"prompt_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cvmate_cv_selection_item" (
	"id" text PRIMARY KEY,
	"cv_build_id" text NOT NULL,
	"parent_selection_item_id" text,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"source_text_snapshot" text,
	"source_data_snapshot" jsonb DEFAULT '{}' NOT NULL,
	"recommended" boolean DEFAULT false NOT NULL,
	"selected" boolean DEFAULT false NOT NULL,
	"recommendation_reason" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cvmate_cv_selection_item_id_build_unique" UNIQUE("id","cv_build_id")
);
--> statement-breakpoint
CREATE TABLE "cvmate_cv_document" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"cv_build_id" text,
	"resume_id" text NOT NULL UNIQUE,
	"status" text DEFAULT 'draft' NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"trashed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cvmate_preferences" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL UNIQUE,
	"theme" text DEFAULT 'light' NOT NULL,
	"settings" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cvmate_job_offer" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"source_url" text,
	"raw_text" text,
	"role_title" text,
	"company_name" text,
	"location" text,
	"language" text,
	"analysis_status" text DEFAULT 'pending' NOT NULL,
	"analyzed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cvmate_job_offer_asset" (
	"id" text PRIMARY KEY,
	"job_offer_id" text NOT NULL,
	"storage_key" text NOT NULL,
	"filename" text NOT NULL,
	"media_type" text NOT NULL,
	"size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cvmate_job_offer_asset_size_nonnegative" CHECK ("size" >= 0),
	CONSTRAINT "cvmate_job_offer_asset_width_positive" CHECK ("width" IS NULL OR "width" > 0),
	CONSTRAINT "cvmate_job_offer_asset_height_positive" CHECK ("height" IS NULL OR "height" > 0)
);
--> statement-breakpoint
CREATE TABLE "cvmate_job_requirement" (
	"id" text PRIMARY KEY,
	"job_offer_id" text NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"priority" text DEFAULT 'additional' NOT NULL,
	"source_text" text,
	"text" text NOT NULL,
	"is_user_edited" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cvmate_job_requirement_text_not_blank" CHECK (btrim("text") <> '')
);
--> statement-breakpoint
CREATE TABLE "cvmate_employment" (
	"id" text PRIMARY KEY,
	"master_profile_id" text NOT NULL,
	"company" text,
	"job_title" text,
	"location" text,
	"start_date" text,
	"end_date" text,
	"is_current" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cvmate_employment_id_profile_unique" UNIQUE("id","master_profile_id"),
	CONSTRAINT "cvmate_employment_not_empty" CHECK (coalesce(btrim("company"), '') <> '' OR coalesce(btrim("job_title"), '') <> '' OR coalesce(btrim("location"), '') <> '' OR coalesce(btrim("start_date"), '') <> '' OR coalesce(btrim("end_date"), '') <> '')
);
--> statement-breakpoint
CREATE TABLE "cvmate_employment_fact" (
	"employment_id" text,
	"experience_fact_id" text,
	"master_profile_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cvmate_employment_fact_pkey" PRIMARY KEY("employment_id","experience_fact_id")
);
--> statement-breakpoint
CREATE TABLE "cvmate_experience_fact" (
	"id" text PRIMARY KEY,
	"master_profile_id" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cvmate_experience_fact_id_profile_unique" UNIQUE("id","master_profile_id"),
	CONSTRAINT "cvmate_experience_fact_text_not_blank" CHECK (btrim("text") <> '')
);
--> statement-breakpoint
CREATE TABLE "cvmate_master_profile" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL UNIQUE,
	"first_name" text,
	"last_name" text,
	"email" text,
	"phone" text,
	"location" text,
	"linkedin_url" text,
	"website_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cvmate_profile_list_item" (
	"id" text PRIMARY KEY,
	"master_profile_id" text NOT NULL,
	"kind" text NOT NULL,
	"value" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cvmate_profile_list_item_value_not_blank" CHECK (btrim("value") <> '')
);
--> statement-breakpoint
CREATE TABLE "cvmate_profile_section" (
	"id" text PRIMARY KEY,
	"master_profile_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cvmate_award" (
	"id" text PRIMARY KEY,
	"master_profile_id" text NOT NULL,
	"name" text,
	"organizer" text,
	"date" text,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cvmate_award_not_empty" CHECK (coalesce(btrim("name"), '') <> '' OR coalesce(btrim("organizer"), '') <> '' OR coalesce(btrim("date"), '') <> '' OR coalesce(btrim("description"), '') <> '')
);
--> statement-breakpoint
CREATE TABLE "cvmate_certification" (
	"id" text PRIMARY KEY,
	"master_profile_id" text NOT NULL,
	"name" text,
	"issuing_organization" text,
	"issue_date" text,
	"expiry_date" text,
	"credential_number" text,
	"credential_url" text,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cvmate_certification_not_empty" CHECK (coalesce(btrim("name"), '') <> '' OR coalesce(btrim("issuing_organization"), '') <> '' OR coalesce(btrim("issue_date"), '') <> '' OR coalesce(btrim("expiry_date"), '') <> '' OR coalesce(btrim("credential_number"), '') <> '' OR coalesce(btrim("credential_url"), '') <> '' OR coalesce(btrim("description"), '') <> '')
);
--> statement-breakpoint
CREATE TABLE "cvmate_clause" (
	"id" text PRIMARY KEY,
	"master_profile_id" text NOT NULL,
	"scope" text NOT NULL,
	"language" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"content" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cvmate_clause_master_profile_id_scope_language_unique" UNIQUE("master_profile_id","scope","language")
);
--> statement-breakpoint
CREATE TABLE "cvmate_course" (
	"id" text PRIMARY KEY,
	"master_profile_id" text NOT NULL,
	"name" text,
	"organizer" text,
	"date" text,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cvmate_course_not_empty" CHECK (coalesce(btrim("name"), '') <> '' OR coalesce(btrim("organizer"), '') <> '' OR coalesce(btrim("date"), '') <> '' OR coalesce(btrim("description"), '') <> '')
);
--> statement-breakpoint
CREATE TABLE "cvmate_custom_section_item" (
	"id" text PRIMARY KEY,
	"profile_section_id" text NOT NULL,
	"title" text,
	"subtitle" text,
	"date" text,
	"description" text,
	"url" text,
	"fields" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cvmate_custom_section_item_not_empty" CHECK (coalesce(btrim("title"), '') <> '' OR coalesce(btrim("subtitle"), '') <> '' OR coalesce(btrim("date"), '') <> '' OR coalesce(btrim("description"), '') <> '' OR coalesce(btrim("url"), '') <> '' OR coalesce("fields", '{}'::jsonb) <> '{}'::jsonb)
);
--> statement-breakpoint
CREATE TABLE "cvmate_education" (
	"id" text PRIMARY KEY,
	"master_profile_id" text NOT NULL,
	"institution" text,
	"field_of_study" text,
	"specialization" text,
	"degree" text,
	"start_date" text,
	"end_date" text,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cvmate_education_not_empty" CHECK (coalesce(btrim("institution"), '') <> '' OR coalesce(btrim("field_of_study"), '') <> '' OR coalesce(btrim("specialization"), '') <> '' OR coalesce(btrim("degree"), '') <> '' OR coalesce(btrim("start_date"), '') <> '' OR coalesce(btrim("end_date"), '') <> '' OR coalesce(btrim("description"), '') <> '')
);
--> statement-breakpoint
CREATE TABLE "cvmate_language" (
	"id" text PRIMARY KEY,
	"master_profile_id" text NOT NULL,
	"language" text,
	"level" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cvmate_language_not_empty" CHECK (coalesce(btrim("language"), '') <> '' OR coalesce(btrim("level"), '') <> '')
);
--> statement-breakpoint
CREATE TABLE "cvmate_license" (
	"id" text PRIMARY KEY,
	"master_profile_id" text NOT NULL,
	"name" text,
	"date" text,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cvmate_license_not_empty" CHECK (coalesce(btrim("name"), '') <> '' OR coalesce(btrim("date"), '') <> '' OR coalesce(btrim("description"), '') <> '')
);
--> statement-breakpoint
CREATE TABLE "cvmate_profile_photo" (
	"id" text PRIMARY KEY,
	"master_profile_id" text NOT NULL,
	"storage_key" text NOT NULL,
	"filename" text NOT NULL,
	"media_type" text NOT NULL,
	"size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"label" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cvmate_profile_photo_size_nonnegative" CHECK ("size" >= 0),
	CONSTRAINT "cvmate_profile_photo_width_positive" CHECK ("width" IS NULL OR "width" > 0),
	CONSTRAINT "cvmate_profile_photo_height_positive" CHECK ("height" IS NULL OR "height" > 0)
);
--> statement-breakpoint
CREATE TABLE "cvmate_project" (
	"id" text PRIMARY KEY,
	"master_profile_id" text NOT NULL,
	"name" text,
	"company" text,
	"start_date" text,
	"end_date" text,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cvmate_project_not_empty" CHECK (coalesce(btrim("name"), '') <> '' OR coalesce(btrim("company"), '') <> '' OR coalesce(btrim("start_date"), '') <> '' OR coalesce(btrim("end_date"), '') <> '' OR coalesce(btrim("description"), '') <> '')
);
--> statement-breakpoint
CREATE TABLE "cvmate_reference" (
	"id" text PRIMARY KEY,
	"master_profile_id" text NOT NULL,
	"name" text,
	"issuer" text,
	"date" text,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cvmate_reference_not_empty" CHECK (coalesce(btrim("name"), '') <> '' OR coalesce(btrim("issuer"), '') <> '' OR coalesce(btrim("date"), '') <> '' OR coalesce(btrim("description"), '') <> '')
);
--> statement-breakpoint
CREATE TABLE "cvmate_volunteer" (
	"id" text PRIMARY KEY,
	"master_profile_id" text NOT NULL,
	"organization" text,
	"role" text,
	"date" text,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cvmate_volunteer_not_empty" CHECK (coalesce(btrim("organization"), '') <> '' OR coalesce(btrim("role"), '') <> '' OR coalesce(btrim("date"), '') <> '' OR coalesce(btrim("description"), '') <> '')
);
--> statement-breakpoint
CREATE INDEX "cvmate_cv_build_user_id_updated_at_index" ON "cvmate_cv_build" ("user_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "cvmate_cv_build_job_offer_id_index" ON "cvmate_cv_build" ("job_offer_id");--> statement-breakpoint
CREATE INDEX "cvmate_cv_build_master_profile_id_index" ON "cvmate_cv_build" ("master_profile_id");--> statement-breakpoint
CREATE INDEX "cvmate_cv_gap_cv_build_id_status_sort_order_index" ON "cvmate_cv_gap" ("cv_build_id","status","sort_order");--> statement-breakpoint
CREATE INDEX "cvmate_cv_gap_job_requirement_id_index" ON "cvmate_cv_gap" ("job_requirement_id");--> statement-breakpoint
CREATE INDEX "cvmate_cv_generated_content_cv_build_id_kind_index" ON "cvmate_cv_generated_content" ("cv_build_id","kind");--> statement-breakpoint
CREATE INDEX "cvmate_cv_generated_content_selection_item_id_index" ON "cvmate_cv_generated_content" ("selection_item_id");--> statement-breakpoint
CREATE INDEX "cvmate_cv_selection_item_cv_build_id_selected_sort_order_index" ON "cvmate_cv_selection_item" ("cv_build_id","selected","sort_order");--> statement-breakpoint
CREATE INDEX "cvmate_cv_selection_item_cv_build_id_source_type_source_id_index" ON "cvmate_cv_selection_item" ("cv_build_id","source_type","source_id");--> statement-breakpoint
CREATE INDEX "cvmate_cv_selection_item_parent_selection_item_id_index" ON "cvmate_cv_selection_item" ("parent_selection_item_id");--> statement-breakpoint
CREATE INDEX "cvmate_cv_document_user_id_trashed_at_updated_at_index" ON "cvmate_cv_document" ("user_id","trashed_at","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "cvmate_cv_document_user_id_status_updated_at_index" ON "cvmate_cv_document" ("user_id","status","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "cvmate_cv_document_user_id_is_favorite_updated_at_index" ON "cvmate_cv_document" ("user_id","is_favorite","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "cvmate_cv_document_cv_build_id_index" ON "cvmate_cv_document" ("cv_build_id");--> statement-breakpoint
CREATE INDEX "cvmate_job_offer_user_id_updated_at_index" ON "cvmate_job_offer" ("user_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "cvmate_job_offer_asset_job_offer_id_sort_order_index" ON "cvmate_job_offer_asset" ("job_offer_id","sort_order");--> statement-breakpoint
CREATE INDEX "cvmate_job_requirement_job_offer_id_category_sort_order_index" ON "cvmate_job_requirement" ("job_offer_id","category","sort_order");--> statement-breakpoint
CREATE INDEX "cvmate_employment_master_profile_id_sort_order_index" ON "cvmate_employment" ("master_profile_id","sort_order");--> statement-breakpoint
CREATE INDEX "cvmate_employment_fact_experience_fact_id_index" ON "cvmate_employment_fact" ("experience_fact_id");--> statement-breakpoint
CREATE INDEX "cvmate_employment_fact_employment_id_sort_order_index" ON "cvmate_employment_fact" ("employment_id","sort_order");--> statement-breakpoint
CREATE INDEX "cvmate_employment_fact_master_profile_id_index" ON "cvmate_employment_fact" ("master_profile_id");--> statement-breakpoint
CREATE INDEX "cvmate_experience_fact_master_profile_id_index" ON "cvmate_experience_fact" ("master_profile_id");--> statement-breakpoint
CREATE INDEX "cvmate_master_profile_updated_at_index" ON "cvmate_master_profile" ("updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "cvmate_profile_list_item_master_profile_id_kind_sort_order_index" ON "cvmate_profile_list_item" ("master_profile_id","kind","sort_order");--> statement-breakpoint
CREATE INDEX "cvmate_profile_section_master_profile_id_sort_order_index" ON "cvmate_profile_section" ("master_profile_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "cvmate_profile_section_standard_unique" ON "cvmate_profile_section" ("master_profile_id","kind") WHERE "kind" <> 'custom';--> statement-breakpoint
CREATE INDEX "cvmate_award_master_profile_id_sort_order_index" ON "cvmate_award" ("master_profile_id","sort_order");--> statement-breakpoint
CREATE INDEX "cvmate_certification_master_profile_id_sort_order_index" ON "cvmate_certification" ("master_profile_id","sort_order");--> statement-breakpoint
CREATE INDEX "cvmate_course_master_profile_id_sort_order_index" ON "cvmate_course" ("master_profile_id","sort_order");--> statement-breakpoint
CREATE INDEX "cvmate_custom_section_item_profile_section_id_sort_order_index" ON "cvmate_custom_section_item" ("profile_section_id","sort_order");--> statement-breakpoint
CREATE INDEX "cvmate_education_master_profile_id_sort_order_index" ON "cvmate_education" ("master_profile_id","sort_order");--> statement-breakpoint
CREATE INDEX "cvmate_language_master_profile_id_sort_order_index" ON "cvmate_language" ("master_profile_id","sort_order");--> statement-breakpoint
CREATE INDEX "cvmate_license_master_profile_id_sort_order_index" ON "cvmate_license" ("master_profile_id","sort_order");--> statement-breakpoint
CREATE INDEX "cvmate_profile_photo_master_profile_id_sort_order_index" ON "cvmate_profile_photo" ("master_profile_id","sort_order");--> statement-breakpoint
CREATE INDEX "cvmate_project_master_profile_id_sort_order_index" ON "cvmate_project" ("master_profile_id","sort_order");--> statement-breakpoint
CREATE INDEX "cvmate_reference_master_profile_id_sort_order_index" ON "cvmate_reference" ("master_profile_id","sort_order");--> statement-breakpoint
CREATE INDEX "cvmate_volunteer_master_profile_id_sort_order_index" ON "cvmate_volunteer" ("master_profile_id","sort_order");--> statement-breakpoint
ALTER TABLE "cvmate_cv_build" ADD CONSTRAINT "cvmate_cv_build_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cvmate_cv_build" ADD CONSTRAINT "cvmate_cv_build_master_profile_id_cvmate_master_profile_id_fkey" FOREIGN KEY ("master_profile_id") REFERENCES "cvmate_master_profile"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "cvmate_cv_build" ADD CONSTRAINT "cvmate_cv_build_job_offer_id_cvmate_job_offer_id_fkey" FOREIGN KEY ("job_offer_id") REFERENCES "cvmate_job_offer"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "cvmate_cv_gap" ADD CONSTRAINT "cvmate_cv_gap_cv_build_id_cvmate_cv_build_id_fkey" FOREIGN KEY ("cv_build_id") REFERENCES "cvmate_cv_build"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cvmate_cv_gap" ADD CONSTRAINT "cvmate_cv_gap_job_requirement_id_cvmate_job_requirement_id_fkey" FOREIGN KEY ("job_requirement_id") REFERENCES "cvmate_job_requirement"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "cvmate_cv_generated_content" ADD CONSTRAINT "cvmate_cv_generated_content_cv_build_id_cvmate_cv_build_id_fkey" FOREIGN KEY ("cv_build_id") REFERENCES "cvmate_cv_build"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cvmate_cv_generated_content" ADD CONSTRAINT "cvmate_cv_generated_content_iau2OzM3Z4FV_fkey" FOREIGN KEY ("selection_item_id") REFERENCES "cvmate_cv_selection_item"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "cvmate_cv_selection_item" ADD CONSTRAINT "cvmate_cv_selection_item_cv_build_id_cvmate_cv_build_id_fkey" FOREIGN KEY ("cv_build_id") REFERENCES "cvmate_cv_build"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cvmate_cv_selection_item" ADD CONSTRAINT "cvmate_cv_selection_item_parent_same_build_fk" FOREIGN KEY ("parent_selection_item_id","cv_build_id") REFERENCES "cvmate_cv_selection_item"("id","cv_build_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cvmate_cv_document" ADD CONSTRAINT "cvmate_cv_document_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cvmate_cv_document" ADD CONSTRAINT "cvmate_cv_document_cv_build_id_cvmate_cv_build_id_fkey" FOREIGN KEY ("cv_build_id") REFERENCES "cvmate_cv_build"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "cvmate_cv_document" ADD CONSTRAINT "cvmate_cv_document_resume_id_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resume"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cvmate_preferences" ADD CONSTRAINT "cvmate_preferences_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cvmate_job_offer" ADD CONSTRAINT "cvmate_job_offer_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cvmate_job_offer_asset" ADD CONSTRAINT "cvmate_job_offer_asset_job_offer_id_cvmate_job_offer_id_fkey" FOREIGN KEY ("job_offer_id") REFERENCES "cvmate_job_offer"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cvmate_job_requirement" ADD CONSTRAINT "cvmate_job_requirement_job_offer_id_cvmate_job_offer_id_fkey" FOREIGN KEY ("job_offer_id") REFERENCES "cvmate_job_offer"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cvmate_employment" ADD CONSTRAINT "cvmate_employment_OPNEzZkScc4A_fkey" FOREIGN KEY ("master_profile_id") REFERENCES "cvmate_master_profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cvmate_employment_fact" ADD CONSTRAINT "cvmate_employment_fact_employment_profile_fk" FOREIGN KEY ("employment_id","master_profile_id") REFERENCES "cvmate_employment"("id","master_profile_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cvmate_employment_fact" ADD CONSTRAINT "cvmate_employment_fact_fact_profile_fk" FOREIGN KEY ("experience_fact_id","master_profile_id") REFERENCES "cvmate_experience_fact"("id","master_profile_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cvmate_experience_fact" ADD CONSTRAINT "cvmate_experience_fact_SJQX8ANbkhe3_fkey" FOREIGN KEY ("master_profile_id") REFERENCES "cvmate_master_profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cvmate_master_profile" ADD CONSTRAINT "cvmate_master_profile_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cvmate_profile_list_item" ADD CONSTRAINT "cvmate_profile_list_item_kZYYvmnlLQAQ_fkey" FOREIGN KEY ("master_profile_id") REFERENCES "cvmate_master_profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cvmate_profile_section" ADD CONSTRAINT "cvmate_profile_section_SNkSbU9WAjIj_fkey" FOREIGN KEY ("master_profile_id") REFERENCES "cvmate_master_profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cvmate_award" ADD CONSTRAINT "cvmate_award_master_profile_id_cvmate_master_profile_id_fkey" FOREIGN KEY ("master_profile_id") REFERENCES "cvmate_master_profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cvmate_certification" ADD CONSTRAINT "cvmate_certification_3HRK4ZlqzE2C_fkey" FOREIGN KEY ("master_profile_id") REFERENCES "cvmate_master_profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cvmate_clause" ADD CONSTRAINT "cvmate_clause_master_profile_id_cvmate_master_profile_id_fkey" FOREIGN KEY ("master_profile_id") REFERENCES "cvmate_master_profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cvmate_course" ADD CONSTRAINT "cvmate_course_master_profile_id_cvmate_master_profile_id_fkey" FOREIGN KEY ("master_profile_id") REFERENCES "cvmate_master_profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cvmate_custom_section_item" ADD CONSTRAINT "cvmate_custom_section_item_v3cFYj4xoDWp_fkey" FOREIGN KEY ("profile_section_id") REFERENCES "cvmate_profile_section"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cvmate_education" ADD CONSTRAINT "cvmate_education_AiWasD08pGcK_fkey" FOREIGN KEY ("master_profile_id") REFERENCES "cvmate_master_profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cvmate_language" ADD CONSTRAINT "cvmate_language_master_profile_id_cvmate_master_profile_id_fkey" FOREIGN KEY ("master_profile_id") REFERENCES "cvmate_master_profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cvmate_license" ADD CONSTRAINT "cvmate_license_master_profile_id_cvmate_master_profile_id_fkey" FOREIGN KEY ("master_profile_id") REFERENCES "cvmate_master_profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cvmate_profile_photo" ADD CONSTRAINT "cvmate_profile_photo_yRrmxREyCgg0_fkey" FOREIGN KEY ("master_profile_id") REFERENCES "cvmate_master_profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cvmate_project" ADD CONSTRAINT "cvmate_project_master_profile_id_cvmate_master_profile_id_fkey" FOREIGN KEY ("master_profile_id") REFERENCES "cvmate_master_profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cvmate_reference" ADD CONSTRAINT "cvmate_reference_uBoCCE9PVapf_fkey" FOREIGN KEY ("master_profile_id") REFERENCES "cvmate_master_profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cvmate_volunteer" ADD CONSTRAINT "cvmate_volunteer_fqUU58sDucU2_fkey" FOREIGN KEY ("master_profile_id") REFERENCES "cvmate_master_profile"("id") ON DELETE CASCADE;