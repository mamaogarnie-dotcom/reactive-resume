import { sql } from "drizzle-orm";
import * as pg from "drizzle-orm/pg-core";
import { generateId } from "@reactive-resume/utils/string";
import { user } from "./auth";

export type CvmateJobOfferAnalysisStatus = "pending" | "analyzed" | "failed";
export type CvmateJobRequirementCategory = "required" | "preferred" | "responsibility" | "keyword" | "other";
export type CvmateRequirementPriority = "critical" | "important" | "additional";

export const cvmateJobOffer = pg.pgTable(
	"cvmate_job_offer",
	{
		id: pg.text("id").notNull().primaryKey().$defaultFn(() => generateId()),
		userId: pg.text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
		sourceUrl: pg.text("source_url"),
		rawText: pg.text("raw_text"),
		roleTitle: pg.text("role_title"),
		companyName: pg.text("company_name"),
		location: pg.text("location"),
		language: pg.text("language"),
		analysisStatus: pg.text("analysis_status").$type<CvmateJobOfferAnalysisStatus>().notNull().default("pending"),
		analyzedAt: pg.timestamp("analyzed_at", { withTimezone: true }),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg.timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [pg.index().on(t.userId, t.updatedAt.desc())],
);

export const cvmateJobOfferAsset = pg.pgTable(
	"cvmate_job_offer_asset",
	{
		id: pg.text("id").notNull().primaryKey().$defaultFn(() => generateId()),
		jobOfferId: pg.text("job_offer_id").notNull().references(() => cvmateJobOffer.id, { onDelete: "cascade" }),
		storageKey: pg.text("storage_key").notNull(),
		filename: pg.text("filename").notNull(),
		mediaType: pg.text("media_type").notNull(),
		size: pg.integer("size").notNull(),
		width: pg.integer("width"),
		height: pg.integer("height"),
		sortOrder: pg.integer("sort_order").notNull().default(0),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		pg.index().on(t.jobOfferId, t.sortOrder),
		pg.check("cvmate_job_offer_asset_size_nonnegative", sql`${t.size} >= 0`),
		pg.check("cvmate_job_offer_asset_width_positive", sql`${t.width} IS NULL OR ${t.width} > 0`),
		pg.check("cvmate_job_offer_asset_height_positive", sql`${t.height} IS NULL OR ${t.height} > 0`),
	],
);

export const cvmateJobRequirement = pg.pgTable(
	"cvmate_job_requirement",
	{
		id: pg.text("id").notNull().primaryKey().$defaultFn(() => generateId()),
		jobOfferId: pg.text("job_offer_id").notNull().references(() => cvmateJobOffer.id, { onDelete: "cascade" }),
		category: pg.text("category").$type<CvmateJobRequirementCategory>().notNull().default("other"),
		priority: pg.text("priority").$type<CvmateRequirementPriority>().notNull().default("additional"),
		sourceText: pg.text("source_text"),
		text: pg.text("text").notNull(),
		isUserEdited: pg.boolean("is_user_edited").notNull().default(false),
		sortOrder: pg.integer("sort_order").notNull().default(0),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg.timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [
		pg.index().on(t.jobOfferId, t.category, t.sortOrder),
		pg.check("cvmate_job_requirement_text_not_blank", sql`btrim(${t.text}) <> ''`),
	],
);
