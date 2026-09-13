UPDATE "cvmate_clause"
SET "scope" = 'current_and_future'
WHERE "scope" = 'future';
--> statement-breakpoint
WITH "ambiguous_profiles" AS (
SELECT "master_profile_id"
FROM "cvmate_clause"
WHERE "is_enabled" = true
GROUP BY "master_profile_id"
HAVING COUNT(DISTINCT "scope") > 1
)
UPDATE "cvmate_clause"
SET "is_enabled" = false
WHERE "master_profile_id" IN (
SELECT "master_profile_id"
FROM "ambiguous_profiles"
);