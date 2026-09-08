import { sql } from "drizzle-orm";
import * as pg from "drizzle-orm/pg-core";
import { generateId } from "@reactive-resume/utils/string";
import { user } from "./auth";

export type CvmateProfileSectionKind =
	| "basics"
	| "experience"
	| "skills"
	| "education"
	| "languages"
	| "clauses"
	| "projects"
	| "courses"
	| "certifications"
	| "volunteer"
	| "software"
	| "tools"
	| "awards"
	| "references"
	| "interests"
	| "licenses"
	| "photos"
	| "custom";

export type CvmateProfileListItemKind = "competency" | "software" | "tool" | "interest";

export const cvmateMasterProfile = pg.pgTable(
	"cvmate_master_profile",
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
		firstName: pg.text("first_name"),
		lastName: pg.text("last_name"),
		email: pg.text("email"),
		phone: pg.text("phone"),
		location: pg.text("location"),
		linkedinUrl: pg.text("linkedin_url"),
		websiteUrl: pg.text("website_url"),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg
			.timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [pg.unique().on(t.userId), pg.index().on(t.updatedAt.desc())],
);

export const cvmateProfileSection = pg.pgTable(
	"cvmate_profile_section",
	{
		id: pg
			.text("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		masterProfileId: pg
			.text("master_profile_id")
			.notNull()
			.references(() => cvmateMasterProfile.id, { onDelete: "cascade" }),
		kind: pg.text("kind").$type<CvmateProfileSectionKind>().notNull(),
		title: pg.text("title").notNull(),
		isVisible: pg.boolean("is_visible").notNull().default(true),
		sortOrder: pg.integer("sort_order").notNull().default(0),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg
			.timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [
		pg.index().on(t.masterProfileId, t.sortOrder),
		pg
			.uniqueIndex("cvmate_profile_section_standard_unique")
			.on(t.masterProfileId, t.kind)
			.where(sql`${t.kind} <> 'custom'`),
	],
);

export const cvmateEmployment = pg.pgTable(
	"cvmate_employment",
	{
		id: pg
			.text("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		masterProfileId: pg
			.text("master_profile_id")
			.notNull()
			.references(() => cvmateMasterProfile.id, { onDelete: "cascade" }),
		company: pg.text("company"),
		jobTitle: pg.text("job_title"),
		location: pg.text("location"),
		startDate: pg.text("start_date"),
		endDate: pg.text("end_date"),
		isCurrent: pg.boolean("is_current").notNull().default(false),
		sortOrder: pg.integer("sort_order").notNull().default(0),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg
			.timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [
		pg.index().on(t.masterProfileId, t.sortOrder),
		pg.unique("cvmate_employment_id_profile_unique").on(t.id, t.masterProfileId),
		pg.check(
			"cvmate_employment_not_empty",
			sql`coalesce(btrim(${t.company}), '') <> '' OR coalesce(btrim(${t.jobTitle}), '') <> '' OR coalesce(btrim(${t.location}), '') <> '' OR coalesce(btrim(${t.startDate}), '') <> '' OR coalesce(btrim(${t.endDate}), '') <> ''`,
		),
	],
);

export const cvmateExperienceFact = pg.pgTable(
	"cvmate_experience_fact",
	{
		id: pg
			.text("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		masterProfileId: pg
			.text("master_profile_id")
			.notNull()
			.references(() => cvmateMasterProfile.id, { onDelete: "cascade" }),
		text: pg.text("text").notNull(),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg
			.timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [
		pg.index().on(t.masterProfileId),
		pg.unique("cvmate_experience_fact_id_profile_unique").on(t.id, t.masterProfileId),
		pg.check("cvmate_experience_fact_text_not_blank", sql`btrim(${t.text}) <> ''`),
	],
);

export const cvmateEmploymentFact = pg.pgTable(
	"cvmate_employment_fact",
	{
		employmentId: pg.text("employment_id").notNull(),
		experienceFactId: pg.text("experience_fact_id").notNull(),
		masterProfileId: pg.text("master_profile_id").notNull(),
		sortOrder: pg.integer("sort_order").notNull().default(0),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		pg.primaryKey({ columns: [t.employmentId, t.experienceFactId] }),
		pg
			.foreignKey({
				name: "cvmate_employment_fact_employment_profile_fk",
				columns: [t.employmentId, t.masterProfileId],
				foreignColumns: [cvmateEmployment.id, cvmateEmployment.masterProfileId],
			})
			.onDelete("cascade"),
		pg
			.foreignKey({
				name: "cvmate_employment_fact_fact_profile_fk",
				columns: [t.experienceFactId, t.masterProfileId],
				foreignColumns: [cvmateExperienceFact.id, cvmateExperienceFact.masterProfileId],
			})
			.onDelete("cascade"),
		pg.index().on(t.experienceFactId),
		pg.index().on(t.employmentId, t.sortOrder),
		pg.index().on(t.masterProfileId),
	],
);

export const cvmateProfileListItem = pg.pgTable(
	"cvmate_profile_list_item",
	{
		id: pg
			.text("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		masterProfileId: pg
			.text("master_profile_id")
			.notNull()
			.references(() => cvmateMasterProfile.id, { onDelete: "cascade" }),
		kind: pg.text("kind").$type<CvmateProfileListItemKind>().notNull(),
		value: pg.text("value").notNull(),
		sortOrder: pg.integer("sort_order").notNull().default(0),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg
			.timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [
		pg.index().on(t.masterProfileId, t.kind, t.sortOrder),
		pg.check("cvmate_profile_list_item_value_not_blank", sql`btrim(${t.value}) <> ''`),
	],
);
