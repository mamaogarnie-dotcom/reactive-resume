import { generateId } from "@reactive-resume/utils/string";
import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import * as pg from "drizzle-orm/pg-core";
import { cvmateMasterProfile, cvmateProfileSection } from "./cvmate-profile";

export type CvmateClauseScope = "current" | "current_and_future";
export type CvmateClauseLanguage = "pl" | "en";

const hasText = (value: AnyPgColumn) => sql`coalesce(btrim(${value}), '') <> ''`;

export const cvmateProject = pg.pgTable(
	"cvmate_project",
	{
		id: pg.text("id").notNull().primaryKey().$defaultFn(() => generateId()),
		masterProfileId: pg.text("master_profile_id").notNull().references(() => cvmateMasterProfile.id, { onDelete: "cascade" }),
		name: pg.text("name"),
		company: pg.text("company"),
		startDate: pg.text("start_date"),
		endDate: pg.text("end_date"),
		description: pg.text("description"),
		sortOrder: pg.integer("sort_order").notNull().default(0),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg.timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [
		pg.index().on(t.masterProfileId, t.sortOrder),
		pg.check("cvmate_project_not_empty", sql`${hasText(t.name)} OR ${hasText(t.company)} OR ${hasText(t.startDate)} OR ${hasText(t.endDate)} OR ${hasText(t.description)}`),
	],
);

export const cvmateEducation = pg.pgTable(
	"cvmate_education",
	{
		id: pg.text("id").notNull().primaryKey().$defaultFn(() => generateId()),
		masterProfileId: pg.text("master_profile_id").notNull().references(() => cvmateMasterProfile.id, { onDelete: "cascade" }),
		institution: pg.text("institution"),
		fieldOfStudy: pg.text("field_of_study"),
		specialization: pg.text("specialization"),
		degree: pg.text("degree"),
		startDate: pg.text("start_date"),
		endDate: pg.text("end_date"),
		description: pg.text("description"),
		sortOrder: pg.integer("sort_order").notNull().default(0),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg.timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [
		pg.index().on(t.masterProfileId, t.sortOrder),
		pg.check("cvmate_education_not_empty", sql`${hasText(t.institution)} OR ${hasText(t.fieldOfStudy)} OR ${hasText(t.specialization)} OR ${hasText(t.degree)} OR ${hasText(t.startDate)} OR ${hasText(t.endDate)} OR ${hasText(t.description)}`),
	],
);

export const cvmateCourse = pg.pgTable(
	"cvmate_course",
	{
		id: pg.text("id").notNull().primaryKey().$defaultFn(() => generateId()),
		masterProfileId: pg.text("master_profile_id").notNull().references(() => cvmateMasterProfile.id, { onDelete: "cascade" }),
		name: pg.text("name"),
		organizer: pg.text("organizer"),
		date: pg.text("date"),
		description: pg.text("description"),
		sortOrder: pg.integer("sort_order").notNull().default(0),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg.timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [
		pg.index().on(t.masterProfileId, t.sortOrder),
		pg.check("cvmate_course_not_empty", sql`${hasText(t.name)} OR ${hasText(t.organizer)} OR ${hasText(t.date)} OR ${hasText(t.description)}`),
	],
);

export const cvmateCertification = pg.pgTable(
	"cvmate_certification",
	{
		id: pg.text("id").notNull().primaryKey().$defaultFn(() => generateId()),
		masterProfileId: pg.text("master_profile_id").notNull().references(() => cvmateMasterProfile.id, { onDelete: "cascade" }),
		name: pg.text("name"),
		issuingOrganization: pg.text("issuing_organization"),
		issueDate: pg.text("issue_date"),
		expiryDate: pg.text("expiry_date"),
		credentialNumber: pg.text("credential_number"),
		credentialUrl: pg.text("credential_url"),
		description: pg.text("description"),
		sortOrder: pg.integer("sort_order").notNull().default(0),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg.timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [
		pg.index().on(t.masterProfileId, t.sortOrder),
		pg.check("cvmate_certification_not_empty", sql`${hasText(t.name)} OR ${hasText(t.issuingOrganization)} OR ${hasText(t.issueDate)} OR ${hasText(t.expiryDate)} OR ${hasText(t.credentialNumber)} OR ${hasText(t.credentialUrl)} OR ${hasText(t.description)}`),
	],
);

export const cvmateVolunteer = pg.pgTable(
	"cvmate_volunteer",
	{
		id: pg.text("id").notNull().primaryKey().$defaultFn(() => generateId()),
		masterProfileId: pg.text("master_profile_id").notNull().references(() => cvmateMasterProfile.id, { onDelete: "cascade" }),
		organization: pg.text("organization"),
		role: pg.text("role"),
		date: pg.text("date"),
		description: pg.text("description"),
		sortOrder: pg.integer("sort_order").notNull().default(0),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg.timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [
		pg.index().on(t.masterProfileId, t.sortOrder),
		pg.check("cvmate_volunteer_not_empty", sql`${hasText(t.organization)} OR ${hasText(t.role)} OR ${hasText(t.date)} OR ${hasText(t.description)}`),
	],
);

export const cvmateLanguage = pg.pgTable(
	"cvmate_language",
	{
		id: pg.text("id").notNull().primaryKey().$defaultFn(() => generateId()),
		masterProfileId: pg.text("master_profile_id").notNull().references(() => cvmateMasterProfile.id, { onDelete: "cascade" }),
		language: pg.text("language"),
		level: pg.text("level"),
		sortOrder: pg.integer("sort_order").notNull().default(0),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg.timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [
		pg.index().on(t.masterProfileId, t.sortOrder),
		pg.check("cvmate_language_not_empty", sql`${hasText(t.language)} OR ${hasText(t.level)}`),
	],
);

export const cvmateAward = pg.pgTable(
	"cvmate_award",
	{
		id: pg.text("id").notNull().primaryKey().$defaultFn(() => generateId()),
		masterProfileId: pg.text("master_profile_id").notNull().references(() => cvmateMasterProfile.id, { onDelete: "cascade" }),
		name: pg.text("name"),
		organizer: pg.text("organizer"),
		date: pg.text("date"),
		description: pg.text("description"),
		sortOrder: pg.integer("sort_order").notNull().default(0),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg.timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [
		pg.index().on(t.masterProfileId, t.sortOrder),
		pg.check("cvmate_award_not_empty", sql`${hasText(t.name)} OR ${hasText(t.organizer)} OR ${hasText(t.date)} OR ${hasText(t.description)}`),
	],
);

export const cvmateReference = pg.pgTable(
	"cvmate_reference",
	{
		id: pg.text("id").notNull().primaryKey().$defaultFn(() => generateId()),
		masterProfileId: pg.text("master_profile_id").notNull().references(() => cvmateMasterProfile.id, { onDelete: "cascade" }),
		name: pg.text("name"),
		issuer: pg.text("issuer"),
		date: pg.text("date"),
		description: pg.text("description"),
		sortOrder: pg.integer("sort_order").notNull().default(0),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg.timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [
		pg.index().on(t.masterProfileId, t.sortOrder),
		pg.check("cvmate_reference_not_empty", sql`${hasText(t.name)} OR ${hasText(t.issuer)} OR ${hasText(t.date)} OR ${hasText(t.description)}`),
	],
);

export const cvmateLicense = pg.pgTable(
	"cvmate_license",
	{
		id: pg.text("id").notNull().primaryKey().$defaultFn(() => generateId()),
		masterProfileId: pg.text("master_profile_id").notNull().references(() => cvmateMasterProfile.id, { onDelete: "cascade" }),
		name: pg.text("name"),
		date: pg.text("date"),
		description: pg.text("description"),
		sortOrder: pg.integer("sort_order").notNull().default(0),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg.timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [
		pg.index().on(t.masterProfileId, t.sortOrder),
		pg.check("cvmate_license_not_empty", sql`${hasText(t.name)} OR ${hasText(t.date)} OR ${hasText(t.description)}`),
	],
);

export const cvmateClause = pg.pgTable(
	"cvmate_clause",
	{
		id: pg.text("id").notNull().primaryKey().$defaultFn(() => generateId()),
		masterProfileId: pg.text("master_profile_id").notNull().references(() => cvmateMasterProfile.id, { onDelete: "cascade" }),
		scope: pg.text("scope").$type<CvmateClauseScope>().notNull(),
		language: pg.text("language").$type<CvmateClauseLanguage>().notNull(),
		isEnabled: pg.boolean("is_enabled").notNull().default(true),
		content: pg.text("content"),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg.timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [pg.unique().on(t.masterProfileId, t.scope, t.language)],
);

export const cvmateCustomSectionItem = pg.pgTable(
	"cvmate_custom_section_item",
	{
		id: pg.text("id").notNull().primaryKey().$defaultFn(() => generateId()),
		profileSectionId: pg.text("profile_section_id").notNull().references(() => cvmateProfileSection.id, { onDelete: "cascade" }),
		title: pg.text("title"),
		subtitle: pg.text("subtitle"),
		date: pg.text("date"),
		description: pg.text("description"),
		url: pg.text("url"),
		fields: pg.jsonb("fields").$type<Record<string, unknown>>(),
		sortOrder: pg.integer("sort_order").notNull().default(0),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg.timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [
		pg.index().on(t.profileSectionId, t.sortOrder),
		pg.check("cvmate_custom_section_item_not_empty", sql`${hasText(t.title)} OR ${hasText(t.subtitle)} OR ${hasText(t.date)} OR ${hasText(t.description)} OR ${hasText(t.url)} OR coalesce(${t.fields}, '{}'::jsonb) <> '{}'::jsonb`),
	],
);

export const cvmateProfilePhoto = pg.pgTable(
	"cvmate_profile_photo",
	{
		id: pg.text("id").notNull().primaryKey().$defaultFn(() => generateId()),
		masterProfileId: pg.text("master_profile_id").notNull().references(() => cvmateMasterProfile.id, { onDelete: "cascade" }),
		storageKey: pg.text("storage_key").notNull(),
		filename: pg.text("filename").notNull(),
		mediaType: pg.text("media_type").notNull(),
		size: pg.integer("size").notNull(),
		width: pg.integer("width"),
		height: pg.integer("height"),
		label: pg.text("label"),
		sortOrder: pg.integer("sort_order").notNull().default(0),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg.timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [
		pg.index().on(t.masterProfileId, t.sortOrder),
		pg.check("cvmate_profile_photo_size_nonnegative", sql`${t.size} >= 0`),
		pg.check("cvmate_profile_photo_width_positive", sql`${t.width} IS NULL OR ${t.width} > 0`),
		pg.check("cvmate_profile_photo_height_positive", sql`${t.height} IS NULL OR ${t.height} > 0`),
	],
);
