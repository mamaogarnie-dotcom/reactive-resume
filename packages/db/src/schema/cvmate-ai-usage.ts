import { generateId } from "@reactive-resume/utils/string";
import { sql } from "drizzle-orm";
import * as pg from "drizzle-orm/pg-core";
import { aiProvider } from "./agent";
import { user } from "./auth";
import { cvmateCvBuild } from "./cvmate-build";
import { cvmateJobOffer } from "./cvmate-job-offer";

export type CvmateAiOperation =
	| "job_offer_analysis"
	| "build_recommendations"
	| "tailored_content";

export const cvmateAiUsage = pg.pgTable(
	"cvmate_ai_usage",
	{
		id: pg
			.text("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		userId: pg
			.text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		cvBuildId: pg
			.text("cv_build_id")
			.references(() => cvmateCvBuild.id, { onDelete: "set null" }),
		jobOfferId: pg
			.text("job_offer_id")
			.references(() => cvmateJobOffer.id, { onDelete: "set null" }),
		aiProviderId: pg
			.text("ai_provider_id")
			.references(() => aiProvider.id, { onDelete: "set null" }),
		operation: pg.text("operation").$type<CvmateAiOperation>().notNull(),
		provider: pg.text("provider").notNull(),
		model: pg.text("model").notNull(),
		inputTokens: pg.integer("input_tokens"),
		outputTokens: pg.integer("output_tokens"),
		cachedInputTokens: pg.integer("cached_input_tokens"),
		totalTokens: pg.integer("total_tokens"),
		usageSnapshot: pg
			.jsonb("usage_snapshot")
			.$type<Record<string, unknown>>()
			.notNull()
			.default({}),
		createdAt: pg
			.timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		pg.index().on(t.userId, t.createdAt.desc()),
		pg.index().on(t.cvBuildId, t.createdAt.desc()),
		pg.index().on(t.jobOfferId, t.createdAt.desc()),
		pg.index().on(t.operation, t.createdAt.desc()),
		pg.check(
			"cvmate_ai_usage_provider_not_blank",
			sql`btrim(${t.provider}) <> ''`,
		),
		pg.check("cvmate_ai_usage_model_not_blank", sql`btrim(${t.model}) <> ''`),
		pg.check(
			"cvmate_ai_usage_input_tokens_nonnegative",
			sql`${t.inputTokens} IS NULL OR ${t.inputTokens} >= 0`,
		),
		pg.check(
			"cvmate_ai_usage_output_tokens_nonnegative",
			sql`${t.outputTokens} IS NULL OR ${t.outputTokens} >= 0`,
		),
		pg.check(
			"cvmate_ai_usage_cached_input_tokens_nonnegative",
			sql`${t.cachedInputTokens} IS NULL OR ${t.cachedInputTokens} >= 0`,
		),
		pg.check(
			"cvmate_ai_usage_total_tokens_nonnegative",
			sql`${t.totalTokens} IS NULL OR ${t.totalTokens} >= 0`,
		),
	],
);
