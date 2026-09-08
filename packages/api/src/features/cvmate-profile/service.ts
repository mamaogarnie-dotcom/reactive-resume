import { ORPCError } from "@orpc/client";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@reactive-resume/db/client";
import * as schema from "@reactive-resume/db/schema";
import { generateId } from "@reactive-resume/utils/string";

const DEFAULT_SECTION_KINDS = [
"basics",
"experience",
"skills",
"education",
"languages",
"clauses",
"projects",
"courses",
"certifications",
"volunteer",
"software",
"tools",
"awards",
"references",
"interests",
"licenses",
"photos",
] as const;

type BasicsFields = {
firstName?: string | null | undefined;
lastName?: string | null | undefined;
email?: string | null | undefined;
phone?: string | null | undefined;
location?: string | null | undefined;
linkedinUrl?: string | null | undefined;
websiteUrl?: string | null | undefined;
};

type EmploymentFields = {
company?: string | null | undefined;
jobTitle?: string | null | undefined;
location?: string | null | undefined;
startDate?: string | null | undefined;
endDate?: string | null | undefined;
isCurrent?: boolean | undefined;
sortOrder?: number | undefined;
};

type ProfileListItemKind = "competency" | "software" | "tool" | "interest";

const stripUserId = <T extends { userId: string }>(row: T) => {
const { userId: _userId, ...rest } = row;
return rest;
};

async function findCurrentProfile(userId: string) {
const [profile] = await db
.select()
.from(schema.cvmateMasterProfile)
.where(eq(schema.cvmateMasterProfile.userId, userId));

return profile;
}

async function requireCurrentProfile(userId: string) {
const profile = await findCurrentProfile(userId);
if (!profile) throw new ORPCError("NOT_FOUND");
return profile;
}

async function createDefaultSections(
tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
masterProfileId: string,
) {
await tx
.insert(schema.cvmateProfileSection)
.values(
DEFAULT_SECTION_KINDS.map((kind, sortOrder) => ({
id: generateId(),
masterProfileId,
kind,
title: "",
isVisible: true,
sortOrder,
})),
)
.onConflictDoNothing();
}

async function ensureProfile(userId: string) {
const existing = await findCurrentProfile(userId);
if (existing) return existing;

return db.transaction(async (tx) => {
const [created] = await tx
.insert(schema.cvmateMasterProfile)
.values({
id: generateId(),
userId,
})
.onConflictDoNothing()
.returning();

if (created) {
await createDefaultSections(tx, created.id);
return created;
}

const [raced] = await tx
.select()
.from(schema.cvmateMasterProfile)
.where(eq(schema.cvmateMasterProfile.userId, userId));

if (!raced) throw new Error("CVMATE_MASTER_PROFILE_CREATE_FAILED");

return raced;
});
}

async function requireOwnedEmployment(id: string, userId: string) {
const profile = await requireCurrentProfile(userId);

const [employment] = await db
.select()
.from(schema.cvmateEmployment)
.where(
and(
eq(schema.cvmateEmployment.id, id),
eq(schema.cvmateEmployment.masterProfileId, profile.id),
),
);

if (!employment) throw new ORPCError("NOT_FOUND");

return { profile, employment };
}

async function requireOwnedExperienceFact(id: string, userId: string) {
const profile = await requireCurrentProfile(userId);

const [fact] = await db
.select()
.from(schema.cvmateExperienceFact)
.where(
and(
eq(schema.cvmateExperienceFact.id, id),
eq(schema.cvmateExperienceFact.masterProfileId, profile.id),
),
);

if (!fact) throw new ORPCError("NOT_FOUND");

return { profile, fact };
}

async function requireOwnedListItem(id: string, userId: string) {
const profile = await requireCurrentProfile(userId);

const [item] = await db
.select()
.from(schema.cvmateProfileListItem)
.where(
and(
eq(schema.cvmateProfileListItem.id, id),
eq(schema.cvmateProfileListItem.masterProfileId, profile.id),
),
);

if (!item) throw new ORPCError("NOT_FOUND");

return { profile, item };
}

function hasEmploymentContent(value: {
company: string | null;
jobTitle: string | null;
location: string | null;
startDate: string | null;
endDate: string | null;
}) {
return [value.company, value.jobTitle, value.location, value.startDate, value.endDate].some(
(field) => typeof field === "string" && field.trim().length > 0,
);
}

export const cvmateProfileService = {
getCurrent: async (input: { userId: string }) => {
const profile = await findCurrentProfile(input.userId);
if (!profile) return null;

const sections = await db
.select()
.from(schema.cvmateProfileSection)
.where(eq(schema.cvmateProfileSection.masterProfileId, profile.id))
.orderBy(
asc(schema.cvmateProfileSection.sortOrder),
asc(schema.cvmateProfileSection.createdAt),
);

const sectionIds = sections.map((section) => section.id);

const [
employments,
experienceFacts,
employmentFacts,
listItems,
projects,
education,
courses,
certifications,
volunteer,
languages,
awards,
references,
licenses,
clauses,
customSectionItems,
photos,
] = await Promise.all([
db
.select()
.from(schema.cvmateEmployment)
.where(eq(schema.cvmateEmployment.masterProfileId, profile.id))
.orderBy(
asc(schema.cvmateEmployment.sortOrder),
asc(schema.cvmateEmployment.createdAt),
),

db
.select()
.from(schema.cvmateExperienceFact)
.where(eq(schema.cvmateExperienceFact.masterProfileId, profile.id))
.orderBy(asc(schema.cvmateExperienceFact.createdAt)),

db
.select()
.from(schema.cvmateEmploymentFact)
.where(eq(schema.cvmateEmploymentFact.masterProfileId, profile.id))
.orderBy(
asc(schema.cvmateEmploymentFact.sortOrder),
asc(schema.cvmateEmploymentFact.createdAt),
),

db
.select()
.from(schema.cvmateProfileListItem)
.where(eq(schema.cvmateProfileListItem.masterProfileId, profile.id))
.orderBy(
asc(schema.cvmateProfileListItem.sortOrder),
asc(schema.cvmateProfileListItem.createdAt),
),

db
.select()
.from(schema.cvmateProject)
.where(eq(schema.cvmateProject.masterProfileId, profile.id))
.orderBy(
asc(schema.cvmateProject.sortOrder),
asc(schema.cvmateProject.createdAt),
),

db
.select()
.from(schema.cvmateEducation)
.where(eq(schema.cvmateEducation.masterProfileId, profile.id))
.orderBy(
asc(schema.cvmateEducation.sortOrder),
asc(schema.cvmateEducation.createdAt),
),

db
.select()
.from(schema.cvmateCourse)
.where(eq(schema.cvmateCourse.masterProfileId, profile.id))
.orderBy(
asc(schema.cvmateCourse.sortOrder),
asc(schema.cvmateCourse.createdAt),
),

db
.select()
.from(schema.cvmateCertification)
.where(eq(schema.cvmateCertification.masterProfileId, profile.id))
.orderBy(
asc(schema.cvmateCertification.sortOrder),
asc(schema.cvmateCertification.createdAt),
),

db
.select()
.from(schema.cvmateVolunteer)
.where(eq(schema.cvmateVolunteer.masterProfileId, profile.id))
.orderBy(
asc(schema.cvmateVolunteer.sortOrder),
asc(schema.cvmateVolunteer.createdAt),
),

db
.select()
.from(schema.cvmateLanguage)
.where(eq(schema.cvmateLanguage.masterProfileId, profile.id))
.orderBy(
asc(schema.cvmateLanguage.sortOrder),
asc(schema.cvmateLanguage.createdAt),
),

db
.select()
.from(schema.cvmateAward)
.where(eq(schema.cvmateAward.masterProfileId, profile.id))
.orderBy(
asc(schema.cvmateAward.sortOrder),
asc(schema.cvmateAward.createdAt),
),

db
.select()
.from(schema.cvmateReference)
.where(eq(schema.cvmateReference.masterProfileId, profile.id))
.orderBy(
asc(schema.cvmateReference.sortOrder),
asc(schema.cvmateReference.createdAt),
),

db
.select()
.from(schema.cvmateLicense)
.where(eq(schema.cvmateLicense.masterProfileId, profile.id))
.orderBy(
asc(schema.cvmateLicense.sortOrder),
asc(schema.cvmateLicense.createdAt),
),

db
.select()
.from(schema.cvmateClause)
.where(eq(schema.cvmateClause.masterProfileId, profile.id))
.orderBy(asc(schema.cvmateClause.createdAt)),

sectionIds.length > 0
? db
.select()
.from(schema.cvmateCustomSectionItem)
.where(inArray(schema.cvmateCustomSectionItem.profileSectionId, sectionIds))
.orderBy(
asc(schema.cvmateCustomSectionItem.sortOrder),
asc(schema.cvmateCustomSectionItem.createdAt),
)
: Promise.resolve([]),

db
.select()
.from(schema.cvmateProfilePhoto)
.where(eq(schema.cvmateProfilePhoto.masterProfileId, profile.id))
.orderBy(
asc(schema.cvmateProfilePhoto.sortOrder),
asc(schema.cvmateProfilePhoto.createdAt),
),
]);

return {
profile: stripUserId(profile),
sections,
employments,
experienceFacts,
employmentFacts,
listItems,
projects,
education,
courses,
certifications,
volunteer,
languages,
awards,
references,
licenses,
clauses,
customSectionItems,
photos,
};
},

updateBasics: async (input: BasicsFields & { userId: string }) => {
const { userId, ...fields } = input;
const profile = await ensureProfile(userId);

const [updated] = await db
.update(schema.cvmateMasterProfile)
.set(fields)
.where(
and(
eq(schema.cvmateMasterProfile.id, profile.id),
eq(schema.cvmateMasterProfile.userId, userId),
),
)
.returning();

if (!updated) throw new ORPCError("NOT_FOUND");

return stripUserId(updated);
},

createEmployment: async (input: EmploymentFields & { userId: string }) => {
const { userId, ...fields } = input;
const profile = await ensureProfile(userId);

const [employment] = await db
.insert(schema.cvmateEmployment)
.values({
id: generateId(),
masterProfileId: profile.id,
...fields,
})
.returning();

if (!employment) throw new Error("CVMATE_EMPLOYMENT_CREATE_FAILED");

return employment;
},

updateEmployment: async (
input: EmploymentFields & {
id: string;
userId: string;
},
) => {
const { employment } = await requireOwnedEmployment(input.id, input.userId);
const { id, userId, ...fields } = input;

const merged = {
company: fields.company !== undefined ? fields.company : employment.company,
jobTitle: fields.jobTitle !== undefined ? fields.jobTitle : employment.jobTitle,
location: fields.location !== undefined ? fields.location : employment.location,
startDate: fields.startDate !== undefined ? fields.startDate : employment.startDate,
endDate: fields.endDate !== undefined ? fields.endDate : employment.endDate,
};

if (!hasEmploymentContent(merged)) {
throw new ORPCError("BAD_REQUEST", {
message: "Employment must contain at least one non-empty business field.",
});
}

const [updated] = await db
.update(schema.cvmateEmployment)
.set(fields)
.where(
and(
eq(schema.cvmateEmployment.id, id),
eq(schema.cvmateEmployment.masterProfileId, employment.masterProfileId),
),
)
.returning();

if (!updated) throw new ORPCError("NOT_FOUND");

return updated;
},

deleteEmployment: async (input: { id: string; userId: string }) => {
const { employment } = await requireOwnedEmployment(input.id, input.userId);

const rows = await db
.delete(schema.cvmateEmployment)
.where(
and(
eq(schema.cvmateEmployment.id, input.id),
eq(schema.cvmateEmployment.masterProfileId, employment.masterProfileId),
),
)
.returning({ id: schema.cvmateEmployment.id });

if (rows.length === 0) throw new ORPCError("NOT_FOUND");
},

createExperienceFact: async (input: { userId: string; text: string }) => {
const profile = await ensureProfile(input.userId);

const [fact] = await db
.insert(schema.cvmateExperienceFact)
.values({
id: generateId(),
masterProfileId: profile.id,
text: input.text,
})
.returning();

if (!fact) throw new Error("CVMATE_EXPERIENCE_FACT_CREATE_FAILED");

return fact;
},

updateExperienceFact: async (input: { id: string; userId: string; text: string }) => {
const { fact } = await requireOwnedExperienceFact(input.id, input.userId);

const [updated] = await db
.update(schema.cvmateExperienceFact)
.set({ text: input.text })
.where(
and(
eq(schema.cvmateExperienceFact.id, input.id),
eq(schema.cvmateExperienceFact.masterProfileId, fact.masterProfileId),
),
)
.returning();

if (!updated) throw new ORPCError("NOT_FOUND");

return updated;
},

deleteExperienceFact: async (input: { id: string; userId: string }) => {
const { fact } = await requireOwnedExperienceFact(input.id, input.userId);

const rows = await db
.delete(schema.cvmateExperienceFact)
.where(
and(
eq(schema.cvmateExperienceFact.id, input.id),
eq(schema.cvmateExperienceFact.masterProfileId, fact.masterProfileId),
),
)
.returning({ id: schema.cvmateExperienceFact.id });

if (rows.length === 0) throw new ORPCError("NOT_FOUND");
},

linkEmploymentFact: async (input: {
userId: string;
employmentId: string;
experienceFactId: string;
sortOrder?: number | undefined;
}) => {
const profile = await requireCurrentProfile(input.userId);

const [employment, fact] = await Promise.all([
db
.select({ id: schema.cvmateEmployment.id })
.from(schema.cvmateEmployment)
.where(
and(
eq(schema.cvmateEmployment.id, input.employmentId),
eq(schema.cvmateEmployment.masterProfileId, profile.id),
),
)
.then((rows) => rows[0]),

db
.select({ id: schema.cvmateExperienceFact.id })
.from(schema.cvmateExperienceFact)
.where(
and(
eq(schema.cvmateExperienceFact.id, input.experienceFactId),
eq(schema.cvmateExperienceFact.masterProfileId, profile.id),
),
)
.then((rows) => rows[0]),
]);

if (!employment || !fact) throw new ORPCError("NOT_FOUND");

const [created] = await db
.insert(schema.cvmateEmploymentFact)
.values({
employmentId: input.employmentId,
experienceFactId: input.experienceFactId,
masterProfileId: profile.id,
sortOrder: input.sortOrder ?? 0,
})
.onConflictDoNothing()
.returning();

if (created) return created;

const [existing] = await db
.select()
.from(schema.cvmateEmploymentFact)
.where(
and(
eq(schema.cvmateEmploymentFact.employmentId, input.employmentId),
eq(schema.cvmateEmploymentFact.experienceFactId, input.experienceFactId),
eq(schema.cvmateEmploymentFact.masterProfileId, profile.id),
),
);

if (!existing) throw new Error("CVMATE_EMPLOYMENT_FACT_LINK_FAILED");

if (input.sortOrder === undefined || existing.sortOrder === input.sortOrder) {
return existing;
}

const [updated] = await db
.update(schema.cvmateEmploymentFact)
.set({ sortOrder: input.sortOrder })
.where(
and(
eq(schema.cvmateEmploymentFact.employmentId, input.employmentId),
eq(schema.cvmateEmploymentFact.experienceFactId, input.experienceFactId),
eq(schema.cvmateEmploymentFact.masterProfileId, profile.id),
),
)
.returning();

if (!updated) throw new Error("CVMATE_EMPLOYMENT_FACT_LINK_UPDATE_FAILED");

return updated;
},

unlinkEmploymentFact: async (input: {
userId: string;
employmentId: string;
experienceFactId: string;
}) => {
const profile = await requireCurrentProfile(input.userId);

const rows = await db
.delete(schema.cvmateEmploymentFact)
.where(
and(
eq(schema.cvmateEmploymentFact.employmentId, input.employmentId),
eq(schema.cvmateEmploymentFact.experienceFactId, input.experienceFactId),
eq(schema.cvmateEmploymentFact.masterProfileId, profile.id),
),
)
.returning({
employmentId: schema.cvmateEmploymentFact.employmentId,
});

if (rows.length === 0) throw new ORPCError("NOT_FOUND");
},

createListItem: async (input: {
userId: string;
kind: ProfileListItemKind;
value: string;
sortOrder?: number | undefined;
}) => {
const profile = await ensureProfile(input.userId);

const [item] = await db
.insert(schema.cvmateProfileListItem)
.values({
id: generateId(),
masterProfileId: profile.id,
kind: input.kind,
value: input.value,
sortOrder: input.sortOrder ?? 0,
})
.returning();

if (!item) throw new Error("CVMATE_PROFILE_LIST_ITEM_CREATE_FAILED");

return item;
},

updateListItem: async (input: {
id: string;
userId: string;
value?: string | undefined;
sortOrder?: number | undefined;
}) => {
const { item } = await requireOwnedListItem(input.id, input.userId);
const { id, userId, ...fields } = input;

const [updated] = await db
.update(schema.cvmateProfileListItem)
.set(fields)
.where(
and(
eq(schema.cvmateProfileListItem.id, id),
eq(schema.cvmateProfileListItem.masterProfileId, item.masterProfileId),
),
)
.returning();

if (!updated) throw new ORPCError("NOT_FOUND");

return updated;
},

deleteListItem: async (input: { id: string; userId: string }) => {
const { item } = await requireOwnedListItem(input.id, input.userId);

const rows = await db
.delete(schema.cvmateProfileListItem)
.where(
and(
eq(schema.cvmateProfileListItem.id, input.id),
eq(schema.cvmateProfileListItem.masterProfileId, item.masterProfileId),
),
)
.returning({ id: schema.cvmateProfileListItem.id });

if (rows.length === 0) throw new ORPCError("NOT_FOUND");
},
};
