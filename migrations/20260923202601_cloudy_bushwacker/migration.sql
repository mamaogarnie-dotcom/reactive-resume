ALTER TABLE "cvmate_cv_build" ADD COLUMN IF NOT EXISTS "identity_snapshot" jsonb;
UPDATE "cvmate_cv_build" AS "build"
SET "identity_snapshot" = jsonb_build_object(
	'id', "profile"."id",
	'firstName', "profile"."first_name",
	'lastName', "profile"."last_name",
	'email', "profile"."email",
	'phone', "profile"."phone",
	'location', "profile"."location",
	'linkedinUrl', "profile"."linkedin_url",
	'websiteUrl', "profile"."website_url"
)
FROM "cvmate_master_profile" AS "profile"
WHERE "build"."identity_snapshot" IS NULL
	AND "build"."master_profile_id" = "profile"."id"
	AND "build"."user_id" = "profile"."user_id";