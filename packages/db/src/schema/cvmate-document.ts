import * as pg from "drizzle-orm/pg-core";
import { generateId } from "@reactive-resume/utils/string";
import { user } from "./auth";
import { cvmateCvBuild } from "./cvmate-build";
import { resume } from "./resume";

export type CvmateDocumentStatus = "draft" | "ready";
export type CvmateTheme = "light" | "pastel" | "dark" | "contrast";

export const cvmateCvDocument = pg.pgTable(
	"cvmate_cv_document",
	{
		id: pg.text("id").notNull().primaryKey().$defaultFn(() => generateId()),
		userId: pg.text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
		cvBuildId: pg.text("cv_build_id").references(() => cvmateCvBuild.id, { onDelete: "set null" }),
		resumeId: pg.text("resume_id").notNull().references(() => resume.id, { onDelete: "cascade" }),
		status: pg.text("status").$type<CvmateDocumentStatus>().notNull().default("draft"),
		isFavorite: pg.boolean("is_favorite").notNull().default(false),
		trashedAt: pg.timestamp("trashed_at", { withTimezone: true }),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg.timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [
		pg.unique().on(t.resumeId),
		pg.index().on(t.userId, t.trashedAt, t.updatedAt.desc()),
		pg.index().on(t.userId, t.status, t.updatedAt.desc()),
		pg.index().on(t.userId, t.isFavorite, t.updatedAt.desc()),
		pg.index().on(t.cvBuildId),
	],
);

export const cvmatePreferences = pg.pgTable(
	"cvmate_preferences",
	{
		id: pg.text("id").notNull().primaryKey().$defaultFn(() => generateId()),
		userId: pg.text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
		theme: pg.text("theme").$type<CvmateTheme>().notNull().default("light"),
		settings: pg.jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg.timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [pg.unique().on(t.userId)],
);
