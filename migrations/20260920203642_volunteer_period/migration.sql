ALTER TABLE "cvmate_volunteer" ADD COLUMN "start_date" text;--> statement-breakpoint
ALTER TABLE "cvmate_volunteer" ADD COLUMN "end_date" text;--> statement-breakpoint
ALTER TABLE "cvmate_volunteer" ADD COLUMN "is_current" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cvmate_volunteer" DROP CONSTRAINT "cvmate_volunteer_not_empty", ADD CONSTRAINT "cvmate_volunteer_not_empty" CHECK (coalesce(btrim("organization"), '') <> '' OR coalesce(btrim("role"), '') <> '' OR coalesce(btrim("date"), '') <> '' OR coalesce(btrim("start_date"), '') <> '' OR coalesce(btrim("end_date"), '') <> '' OR coalesce(btrim("description"), '') <> '');
UPDATE "cvmate_volunteer" SET "start_date" = "date" WHERE "start_date" IS NULL AND "date" IS NOT NULL;--> statement-breakpoint
