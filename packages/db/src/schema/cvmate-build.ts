import * as pg from "drizzle-orm/pg-core";
import { generateId } from "@reactive-resume/utils/string";
import { user } from "./auth";
import { cvmateJobOffer, cvmateJobRequirement, type CvmateRequirementPriority } from "./cvmate-job-offer";
import { cvmateMasterProfile } from "./cvmate-profile";

export type CvmateBuildStep = "offer" | "analysis" | "selection" | "gaps" | "preview" | "editor" | "review" | "completed";
export type CvmateBuildStatus = "active" | "completed" | "abandoned";
export type CvmateSelectionSourceType =
	| "employment"
	| "experience_fact"
	| "project"
	| "education"
	| "course"
	| "certification"
	| "volunteer"
	| "language"
	| "award"
	| "reference"
	| "license"
	| "profile_list_item"
	| "clause"
	| "profile_photo"
	| "custom_section_item";
export type CvmateGapOrigin = "detected" | "user";
export type CvmateGapStatus = "open" | "resolved" | "dismissed";
export type CvmateGeneratedContentKind = "professional_summary" | "experience_fact" | "section_title" | "other";

export const cvmateCvBuild = pg.pgTable(
	"cvmate_cv_build",
	{
		id: pg.text("id").notNull().primaryKey().$defaultFn(() => generateId()),
		userId: pg.text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
		masterProfileId: pg.text("master_profile_id").references(() => cvmateMasterProfile.id, { onDelete: "set null" }),
		jobOfferId: pg.text("job_offer_id").references(() => cvmateJobOffer.id, { onDelete: "set null" }),
		currentStep: pg.text("current_step").$type<CvmateBuildStep>().notNull().default("offer"),
		status: pg.text("status").$type<CvmateBuildStatus>().notNull().default("active"),
		targetLanguage: pg.text("target_language"),
		jobOfferSnapshot: pg.jsonb("job_offer_snapshot").$type<Record<string, unknown>>(),
		designSettings: pg.jsonb("design_settings").$type<Record<string, unknown>>(),
		completedAt: pg.timestamp("completed_at", { withTimezone: true }),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg.timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [pg.index().on(t.userId, t.updatedAt.desc()), pg.index().on(t.jobOfferId), pg.index().on(t.masterProfileId)],
);

export const cvmateCvSelectionItem = pg.pgTable(
	"cvmate_cv_selection_item",
	{
		id: pg.text("id").notNull().primaryKey().$defaultFn(() => generateId()),
		cvBuildId: pg.text("cv_build_id").notNull().references(() => cvmateCvBuild.id, { onDelete: "cascade" }),
		parentSelectionItemId: pg.text("parent_selection_item_id"),
		sourceType: pg.text("source_type").$type<CvmateSelectionSourceType>().notNull(),
		sourceId: pg.text("source_id").notNull(),
		sourceTextSnapshot: pg.text("source_text_snapshot"),
		sourceDataSnapshot: pg.jsonb("source_data_snapshot").$type<Record<string, unknown>>().notNull().default({}),
		recommended: pg.boolean("recommended").notNull().default(false),
		selected: pg.boolean("selected").notNull().default(false),
		recommendationReason: pg.text("recommendation_reason"),
		sortOrder: pg.integer("sort_order").notNull().default(0),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg.timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [
		pg.unique("cvmate_cv_selection_item_id_build_unique").on(t.id, t.cvBuildId),
		pg
			.foreignKey({
				name: "cvmate_cv_selection_item_parent_same_build_fk",
				columns: [t.parentSelectionItemId, t.cvBuildId],
				foreignColumns: [t.id, t.cvBuildId],
			})
			.onDelete("cascade"),
		pg.index().on(t.cvBuildId, t.selected, t.sortOrder),
		pg.index().on(t.cvBuildId, t.sourceType, t.sourceId),
		pg.index().on(t.parentSelectionItemId),
	],
);

export const cvmateCvGap = pg.pgTable(
	"cvmate_cv_gap",
	{
		id: pg.text("id").notNull().primaryKey().$defaultFn(() => generateId()),
		cvBuildId: pg.text("cv_build_id").notNull().references(() => cvmateCvBuild.id, { onDelete: "cascade" }),
		jobRequirementId: pg.text("job_requirement_id").references(() => cvmateJobRequirement.id, { onDelete: "set null" }),
		requirementTextSnapshot: pg.text("requirement_text_snapshot"),
		text: pg.text("text").notNull(),
		severity: pg.text("severity").$type<CvmateRequirementPriority>().notNull().default("additional"),
		origin: pg.text("origin").$type<CvmateGapOrigin>().notNull().default("detected"),
		status: pg.text("status").$type<CvmateGapStatus>().notNull().default("open"),
		resolutionSourceType: pg.text("resolution_source_type").$type<CvmateSelectionSourceType>(),
		resolutionSourceId: pg.text("resolution_source_id"),
		resolutionTextSnapshot: pg.text("resolution_text_snapshot"),
		sortOrder: pg.integer("sort_order").notNull().default(0),
		resolvedAt: pg.timestamp("resolved_at", { withTimezone: true }),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg.timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [pg.index().on(t.cvBuildId, t.status, t.sortOrder), pg.index().on(t.jobRequirementId)],
);

export const cvmateCvGeneratedContent = pg.pgTable(
	"cvmate_cv_generated_content",
	{
		id: pg.text("id").notNull().primaryKey().$defaultFn(() => generateId()),
		cvBuildId: pg.text("cv_build_id").notNull().references(() => cvmateCvBuild.id, { onDelete: "cascade" }),
		selectionItemId: pg.text("selection_item_id").references(() => cvmateCvSelectionItem.id, { onDelete: "set null" }),
		kind: pg.text("kind").$type<CvmateGeneratedContentKind>().notNull(),
		sourceText: pg.text("source_text"),
		sourceDataSnapshot: pg.jsonb("source_data_snapshot").$type<Record<string, unknown>>().notNull().default({}),
		aiText: pg.text("ai_text"),
		finalText: pg.text("final_text"),
		model: pg.text("model"),
		promptVersion: pg.text("prompt_version"),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg.timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [pg.index().on(t.cvBuildId, t.kind), pg.index().on(t.selectionItemId)],
);
