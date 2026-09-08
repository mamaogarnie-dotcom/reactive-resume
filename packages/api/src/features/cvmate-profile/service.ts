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

type ProjectFields = {
name?: string | null | undefined;
company?: string | null | undefined;
startDate?: string | null | undefined;
endDate?: string | null | undefined;
description?: string | null | undefined;
sortOrder?: number | undefined;
};

type EducationFields = {
institution?: string | null | undefined;
fieldOfStudy?: string | null | undefined;
specialization?: string | null | undefined;
degree?: string | null | undefined;
startDate?: string | null | undefined;
endDate?: string | null | undefined;
description?: string | null | undefined;
sortOrder?: number | undefined;
};

type CourseFields = {
name?: string | null | undefined;
organizer?: string | null | undefined;
date?: string | null | undefined;
description?: string | null | undefined;
sortOrder?: number | undefined;
};

type CertificationFields = {
name?: string | null | undefined;
issuingOrganization?: string | null | undefined;
issueDate?: string | null | undefined;
expiryDate?: string | null | undefined;
credentialNumber?: string | null | undefined;
credentialUrl?: string | null | undefined;
description?: string | null | undefined;
sortOrder?: number | undefined;
};

type VolunteerFields = {
organization?: string | null | undefined;
role?: string | null | undefined;
date?: string | null | undefined;
description?: string | null | undefined;
sortOrder?: number | undefined;
};

type LanguageFields = {
language?: string | null | undefined;
level?: string | null | undefined;
sortOrder?: number | undefined;
};

type AwardFields = {
name?: string | null | undefined;
organizer?: string | null | undefined;
date?: string | null | undefined;
description?: string | null | undefined;
sortOrder?: number | undefined;
};

type ReferenceFields = {
name?: string | null | undefined;
issuer?: string | null | undefined;
date?: string | null | undefined;
description?: string | null | undefined;
sortOrder?: number | undefined;
};

type LicenseFields = {
name?: string | null | undefined;
date?: string | null | undefined;
description?: string | null | undefined;
sortOrder?: number | undefined;
};
type ClauseScope = "current" | "future";
type ClauseLanguage = "pl" | "en";

type ClauseFields = {
scope: ClauseScope;
language: ClauseLanguage;
isEnabled?: boolean | undefined;
content?: string | null | undefined;
};
type CustomSectionItemFields = {
title?: string | null | undefined;
subtitle?: string | null | undefined;
date?: string | null | undefined;
description?: string | null | undefined;
url?: string | null | undefined;
fields?: Record<string, unknown> | null | undefined;
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

async function requireOwnedProject(id: string, userId: string) {
const profile = await requireCurrentProfile(userId);

const [project] = await db
.select()
.from(schema.cvmateProject)
.where(
and(
eq(schema.cvmateProject.id, id),
eq(schema.cvmateProject.masterProfileId, profile.id),
),
);

if (!project) throw new ORPCError("NOT_FOUND");

return { profile, project };
}

async function requireOwnedEducation(id: string, userId: string) {
const profile = await requireCurrentProfile(userId);

const [education] = await db
.select()
.from(schema.cvmateEducation)
.where(
and(
eq(schema.cvmateEducation.id, id),
eq(schema.cvmateEducation.masterProfileId, profile.id),
),
);

if (!education) throw new ORPCError("NOT_FOUND");

return { profile, education };
}

async function requireOwnedCourse(id: string, userId: string) {
const profile = await requireCurrentProfile(userId);

const [course] = await db
.select()
.from(schema.cvmateCourse)
.where(
and(
eq(schema.cvmateCourse.id, id),
eq(schema.cvmateCourse.masterProfileId, profile.id),
),
);

if (!course) throw new ORPCError("NOT_FOUND");

return { profile, course };
}

async function requireOwnedCertification(id: string, userId: string) {
const profile = await requireCurrentProfile(userId);

const [certification] = await db
.select()
.from(schema.cvmateCertification)
.where(
and(
eq(schema.cvmateCertification.id, id),
eq(schema.cvmateCertification.masterProfileId, profile.id),
),
);

if (!certification) throw new ORPCError("NOT_FOUND");

return { profile, certification };
}

async function requireOwnedVolunteer(id: string, userId: string) {
const profile = await requireCurrentProfile(userId);

const [volunteer] = await db
.select()
.from(schema.cvmateVolunteer)
.where(
and(
eq(schema.cvmateVolunteer.id, id),
eq(schema.cvmateVolunteer.masterProfileId, profile.id),
),
);

if (!volunteer) throw new ORPCError("NOT_FOUND");

return { profile, volunteer };
}

async function requireOwnedLanguage(id: string, userId: string) {
const profile = await requireCurrentProfile(userId);

const [language] = await db
.select()
.from(schema.cvmateLanguage)
.where(
and(
eq(schema.cvmateLanguage.id, id),
eq(schema.cvmateLanguage.masterProfileId, profile.id),
),
);

if (!language) throw new ORPCError("NOT_FOUND");

return { profile, language };
}

async function requireOwnedAward(id: string, userId: string) {
const profile = await requireCurrentProfile(userId);

const [award] = await db
.select()
.from(schema.cvmateAward)
.where(
and(
eq(schema.cvmateAward.id, id),
eq(schema.cvmateAward.masterProfileId, profile.id),
),
);

if (!award) throw new ORPCError("NOT_FOUND");

return { profile, award };
}

async function requireOwnedReference(id: string, userId: string) {
const profile = await requireCurrentProfile(userId);

const [reference] = await db
.select()
.from(schema.cvmateReference)
.where(
and(
eq(schema.cvmateReference.id, id),
eq(schema.cvmateReference.masterProfileId, profile.id),
),
);

if (!reference) throw new ORPCError("NOT_FOUND");

return { profile, reference };
}

async function requireOwnedLicense(id: string, userId: string) {
const profile = await requireCurrentProfile(userId);

const [license] = await db
.select()
.from(schema.cvmateLicense)
.where(
and(
eq(schema.cvmateLicense.id, id),
eq(schema.cvmateLicense.masterProfileId, profile.id),
),
);

if (!license) throw new ORPCError("NOT_FOUND");

return { profile, license };
}
async function requireOwnedCustomSection(id: string, userId: string) {
const profile = await requireCurrentProfile(userId);

const [section] = await db
.select()
.from(schema.cvmateProfileSection)
.where(
and(
eq(schema.cvmateProfileSection.id, id),
eq(schema.cvmateProfileSection.masterProfileId, profile.id),
eq(schema.cvmateProfileSection.kind, "custom"),
),
);

if (!section) throw new ORPCError("NOT_FOUND");

return { profile, section };
}

async function requireOwnedCustomSectionItem(id: string, userId: string) {
const [item] = await db
.select()
.from(schema.cvmateCustomSectionItem)
.where(eq(schema.cvmateCustomSectionItem.id, id));

if (!item) throw new ORPCError("NOT_FOUND");

const { profile, section } = await requireOwnedCustomSection(
item.profileSectionId,
userId,
);

return { profile, section, item };
}

function hasCustomSectionItemContent(value: {
title: string | null;
subtitle: string | null;
date: string | null;
description: string | null;
url: string | null;
fields: Record<string, unknown> | null;
}) {
return (
[
value.title,
value.subtitle,
value.date,
value.description,
value.url,
].some(
(field) => typeof field === "string" && field.trim().length > 0,
) ||
(value.fields !== null && Object.keys(value.fields).length > 0)
);
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

function hasProjectContent(value: {
name: string | null;
company: string | null;
startDate: string | null;
endDate: string | null;
description: string | null;
}) {
return [value.name, value.company, value.startDate, value.endDate, value.description].some(
(field) => typeof field === "string" && field.trim().length > 0,
);
}

function hasEducationContent(value: {
institution: string | null;
fieldOfStudy: string | null;
specialization: string | null;
degree: string | null;
startDate: string | null;
endDate: string | null;
description: string | null;
}) {
return [
value.institution,
value.fieldOfStudy,
value.specialization,
value.degree,
value.startDate,
value.endDate,
value.description,
].some((field) => typeof field === "string" && field.trim().length > 0);
}

function hasCourseContent(value: {
name: string | null;
organizer: string | null;
date: string | null;
description: string | null;
}) {
return [value.name, value.organizer, value.date, value.description].some(
(field) => typeof field === "string" && field.trim().length > 0,
);
}

function hasCertificationContent(value: {
name: string | null;
issuingOrganization: string | null;
issueDate: string | null;
expiryDate: string | null;
credentialNumber: string | null;
credentialUrl: string | null;
description: string | null;
}) {
return [
value.name,
value.issuingOrganization,
value.issueDate,
value.expiryDate,
value.credentialNumber,
value.credentialUrl,
value.description,
].some((field) => typeof field === "string" && field.trim().length > 0);
}

function hasVolunteerContent(value: {
organization: string | null;
role: string | null;
date: string | null;
description: string | null;
}) {
return [value.organization, value.role, value.date, value.description].some(
(field) => typeof field === "string" && field.trim().length > 0,
);
}

function hasLanguageContent(value: {
language: string | null;
level: string | null;
}) {
return [value.language, value.level].some(
(field) => typeof field === "string" && field.trim().length > 0,
);
}

function hasAwardContent(value: {
name: string | null;
organizer: string | null;
date: string | null;
description: string | null;
}) {
return [value.name, value.organizer, value.date, value.description].some(
(field) => typeof field === "string" && field.trim().length > 0,
);
}

function hasReferenceContent(value: {
name: string | null;
issuer: string | null;
date: string | null;
description: string | null;
}) {
return [value.name, value.issuer, value.date, value.description].some(
(field) => typeof field === "string" && field.trim().length > 0,
);
}

function hasLicenseContent(value: {
name: string | null;
date: string | null;
description: string | null;
}) {
return [value.name, value.date, value.description].some(
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

createProject: async (input: ProjectFields & { userId: string }) => {
const { userId, ...fields } = input;
const profile = await ensureProfile(userId);

const [project] = await db
.insert(schema.cvmateProject)
.values({
id: generateId(),
masterProfileId: profile.id,
...fields,
})
.returning();

if (!project) throw new Error("CVMATE_PROJECT_CREATE_FAILED");

return project;
},

updateProject: async (
input: ProjectFields & {
id: string;
userId: string;
},
) => {
const { project } = await requireOwnedProject(input.id, input.userId);
const { id, userId, ...fields } = input;

const merged = {
name: fields.name !== undefined ? fields.name : project.name,
company: fields.company !== undefined ? fields.company : project.company,
startDate: fields.startDate !== undefined ? fields.startDate : project.startDate,
endDate: fields.endDate !== undefined ? fields.endDate : project.endDate,
description: fields.description !== undefined ? fields.description : project.description,
};

if (!hasProjectContent(merged)) {
throw new ORPCError("BAD_REQUEST", {
message: "Project must contain at least one non-empty business field.",
});
}

const [updated] = await db
.update(schema.cvmateProject)
.set(fields)
.where(
and(
eq(schema.cvmateProject.id, id),
eq(schema.cvmateProject.masterProfileId, project.masterProfileId),
),
)
.returning();

if (!updated) throw new ORPCError("NOT_FOUND");

return updated;
},

deleteProject: async (input: { id: string; userId: string }) => {
const { project } = await requireOwnedProject(input.id, input.userId);

const rows = await db
.delete(schema.cvmateProject)
.where(
and(
eq(schema.cvmateProject.id, input.id),
eq(schema.cvmateProject.masterProfileId, project.masterProfileId),
),
)
.returning({ id: schema.cvmateProject.id });

if (rows.length === 0) throw new ORPCError("NOT_FOUND");
},

createEducation: async (input: EducationFields & { userId: string }) => {
const { userId, ...fields } = input;
const profile = await ensureProfile(userId);

const [education] = await db
.insert(schema.cvmateEducation)
.values({
id: generateId(),
masterProfileId: profile.id,
...fields,
})
.returning();

if (!education) throw new Error("CVMATE_EDUCATION_CREATE_FAILED");

return education;
},

updateEducation: async (
input: EducationFields & {
id: string;
userId: string;
},
) => {
const { education } = await requireOwnedEducation(input.id, input.userId);
const { id, userId, ...fields } = input;

const merged = {
institution:
fields.institution !== undefined ? fields.institution : education.institution,
fieldOfStudy:
fields.fieldOfStudy !== undefined ? fields.fieldOfStudy : education.fieldOfStudy,
specialization:
fields.specialization !== undefined
? fields.specialization
: education.specialization,
degree: fields.degree !== undefined ? fields.degree : education.degree,
startDate: fields.startDate !== undefined ? fields.startDate : education.startDate,
endDate: fields.endDate !== undefined ? fields.endDate : education.endDate,
description:
fields.description !== undefined ? fields.description : education.description,
};

if (!hasEducationContent(merged)) {
throw new ORPCError("BAD_REQUEST", {
message: "Education must contain at least one non-empty business field.",
});
}

const [updated] = await db
.update(schema.cvmateEducation)
.set(fields)
.where(
and(
eq(schema.cvmateEducation.id, id),
eq(schema.cvmateEducation.masterProfileId, education.masterProfileId),
),
)
.returning();

if (!updated) throw new ORPCError("NOT_FOUND");

return updated;
},

deleteEducation: async (input: { id: string; userId: string }) => {
const { education } = await requireOwnedEducation(input.id, input.userId);

const rows = await db
.delete(schema.cvmateEducation)
.where(
and(
eq(schema.cvmateEducation.id, input.id),
eq(schema.cvmateEducation.masterProfileId, education.masterProfileId),
),
)
.returning({ id: schema.cvmateEducation.id });

if (rows.length === 0) throw new ORPCError("NOT_FOUND");
},

createCourse: async (input: CourseFields & { userId: string }) => {
const { userId, ...fields } = input;
const profile = await ensureProfile(userId);

const [course] = await db
.insert(schema.cvmateCourse)
.values({
id: generateId(),
masterProfileId: profile.id,
...fields,
})
.returning();

if (!course) throw new Error("CVMATE_COURSE_CREATE_FAILED");

return course;
},

updateCourse: async (
input: CourseFields & {
id: string;
userId: string;
},
) => {
const { course } = await requireOwnedCourse(input.id, input.userId);
const { id, userId, ...fields } = input;

const merged = {
name: fields.name !== undefined ? fields.name : course.name,
organizer: fields.organizer !== undefined ? fields.organizer : course.organizer,
date: fields.date !== undefined ? fields.date : course.date,
description:
fields.description !== undefined ? fields.description : course.description,
};

if (!hasCourseContent(merged)) {
throw new ORPCError("BAD_REQUEST", {
message: "Course must contain at least one non-empty business field.",
});
}

const [updated] = await db
.update(schema.cvmateCourse)
.set(fields)
.where(
and(
eq(schema.cvmateCourse.id, id),
eq(schema.cvmateCourse.masterProfileId, course.masterProfileId),
),
)
.returning();

if (!updated) throw new ORPCError("NOT_FOUND");

return updated;
},

deleteCourse: async (input: { id: string; userId: string }) => {
const { course } = await requireOwnedCourse(input.id, input.userId);

const rows = await db
.delete(schema.cvmateCourse)
.where(
and(
eq(schema.cvmateCourse.id, input.id),
eq(schema.cvmateCourse.masterProfileId, course.masterProfileId),
),
)
.returning({ id: schema.cvmateCourse.id });

if (rows.length === 0) throw new ORPCError("NOT_FOUND");
},

createCertification: async (input: CertificationFields & { userId: string }) => {
const { userId, ...fields } = input;
const profile = await ensureProfile(userId);

const [certification] = await db
.insert(schema.cvmateCertification)
.values({
id: generateId(),
masterProfileId: profile.id,
...fields,
})
.returning();

if (!certification) throw new Error("CVMATE_CERTIFICATION_CREATE_FAILED");

return certification;
},

updateCertification: async (
input: CertificationFields & {
id: string;
userId: string;
},
) => {
const { certification } = await requireOwnedCertification(input.id, input.userId);
const { id, userId, ...fields } = input;

const merged = {
name: fields.name !== undefined ? fields.name : certification.name,
issuingOrganization:
fields.issuingOrganization !== undefined
? fields.issuingOrganization
: certification.issuingOrganization,
issueDate:
fields.issueDate !== undefined ? fields.issueDate : certification.issueDate,
expiryDate:
fields.expiryDate !== undefined ? fields.expiryDate : certification.expiryDate,
credentialNumber:
fields.credentialNumber !== undefined
? fields.credentialNumber
: certification.credentialNumber,
credentialUrl:
fields.credentialUrl !== undefined
? fields.credentialUrl
: certification.credentialUrl,
description:
fields.description !== undefined
? fields.description
: certification.description,
};

if (!hasCertificationContent(merged)) {
throw new ORPCError("BAD_REQUEST", {
message: "Certification must contain at least one non-empty business field.",
});
}

const [updated] = await db
.update(schema.cvmateCertification)
.set(fields)
.where(
and(
eq(schema.cvmateCertification.id, id),
eq(
schema.cvmateCertification.masterProfileId,
certification.masterProfileId,
),
),
)
.returning();

if (!updated) throw new ORPCError("NOT_FOUND");

return updated;
},

deleteCertification: async (input: { id: string; userId: string }) => {
const { certification } = await requireOwnedCertification(input.id, input.userId);

const rows = await db
.delete(schema.cvmateCertification)
.where(
and(
eq(schema.cvmateCertification.id, input.id),
eq(
schema.cvmateCertification.masterProfileId,
certification.masterProfileId,
),
),
)
.returning({ id: schema.cvmateCertification.id });

if (rows.length === 0) throw new ORPCError("NOT_FOUND");
},

createVolunteer: async (input: VolunteerFields & { userId: string }) => {
const { userId, ...fields } = input;
const profile = await ensureProfile(userId);

const [volunteer] = await db
.insert(schema.cvmateVolunteer)
.values({
id: generateId(),
masterProfileId: profile.id,
...fields,
})
.returning();

if (!volunteer) throw new Error("CVMATE_VOLUNTEER_CREATE_FAILED");

return volunteer;
},

updateVolunteer: async (
input: VolunteerFields & {
id: string;
userId: string;
},
) => {
const { volunteer } = await requireOwnedVolunteer(input.id, input.userId);
const { id, userId, ...fields } = input;

const merged = {
organization:
fields.organization !== undefined
? fields.organization
: volunteer.organization,
role: fields.role !== undefined ? fields.role : volunteer.role,
date: fields.date !== undefined ? fields.date : volunteer.date,
description:
fields.description !== undefined
? fields.description
: volunteer.description,
};

if (!hasVolunteerContent(merged)) {
throw new ORPCError("BAD_REQUEST", {
message: "Volunteer record must contain at least one non-empty business field.",
});
}

const [updated] = await db
.update(schema.cvmateVolunteer)
.set(fields)
.where(
and(
eq(schema.cvmateVolunteer.id, id),
eq(schema.cvmateVolunteer.masterProfileId, volunteer.masterProfileId),
),
)
.returning();

if (!updated) throw new ORPCError("NOT_FOUND");

return updated;
},

deleteVolunteer: async (input: { id: string; userId: string }) => {
const { volunteer } = await requireOwnedVolunteer(input.id, input.userId);

const rows = await db
.delete(schema.cvmateVolunteer)
.where(
and(
eq(schema.cvmateVolunteer.id, input.id),
eq(schema.cvmateVolunteer.masterProfileId, volunteer.masterProfileId),
),
)
.returning({ id: schema.cvmateVolunteer.id });

if (rows.length === 0) throw new ORPCError("NOT_FOUND");
},

createLanguage: async (input: LanguageFields & { userId: string }) => {
const { userId, ...fields } = input;
const profile = await ensureProfile(userId);

const [language] = await db
.insert(schema.cvmateLanguage)
.values({
id: generateId(),
masterProfileId: profile.id,
...fields,
})
.returning();

if (!language) throw new Error("CVMATE_LANGUAGE_CREATE_FAILED");

return language;
},

updateLanguage: async (
input: LanguageFields & {
id: string;
userId: string;
},
) => {
const { language } = await requireOwnedLanguage(input.id, input.userId);
const { id, userId, ...fields } = input;

const merged = {
language:
fields.language !== undefined ? fields.language : language.language,
level: fields.level !== undefined ? fields.level : language.level,
};

if (!hasLanguageContent(merged)) {
throw new ORPCError("BAD_REQUEST", {
message: "Language record must contain at least one non-empty business field.",
});
}

const [updated] = await db
.update(schema.cvmateLanguage)
.set(fields)
.where(
and(
eq(schema.cvmateLanguage.id, id),
eq(schema.cvmateLanguage.masterProfileId, language.masterProfileId),
),
)
.returning();

if (!updated) throw new ORPCError("NOT_FOUND");

return updated;
},

deleteLanguage: async (input: { id: string; userId: string }) => {
const { language } = await requireOwnedLanguage(input.id, input.userId);

const rows = await db
.delete(schema.cvmateLanguage)
.where(
and(
eq(schema.cvmateLanguage.id, input.id),
eq(schema.cvmateLanguage.masterProfileId, language.masterProfileId),
),
)
.returning({ id: schema.cvmateLanguage.id });

if (rows.length === 0) throw new ORPCError("NOT_FOUND");
},

createAward: async (input: AwardFields & { userId: string }) => {
const { userId, ...fields } = input;
const profile = await ensureProfile(userId);

const [award] = await db
.insert(schema.cvmateAward)
.values({
id: generateId(),
masterProfileId: profile.id,
...fields,
})
.returning();

if (!award) throw new Error("CVMATE_AWARD_CREATE_FAILED");

return award;
},

updateAward: async (
input: AwardFields & {
id: string;
userId: string;
},
) => {
const { award } = await requireOwnedAward(input.id, input.userId);
const { id, userId, ...fields } = input;

const merged = {
name: fields.name !== undefined ? fields.name : award.name,
organizer:
fields.organizer !== undefined ? fields.organizer : award.organizer,
date: fields.date !== undefined ? fields.date : award.date,
description:
fields.description !== undefined ? fields.description : award.description,
};

if (!hasAwardContent(merged)) {
throw new ORPCError("BAD_REQUEST", {
message: "Award must contain at least one non-empty business field.",
});
}

const [updated] = await db
.update(schema.cvmateAward)
.set(fields)
.where(
and(
eq(schema.cvmateAward.id, id),
eq(schema.cvmateAward.masterProfileId, award.masterProfileId),
),
)
.returning();

if (!updated) throw new ORPCError("NOT_FOUND");

return updated;
},

deleteAward: async (input: { id: string; userId: string }) => {
const { award } = await requireOwnedAward(input.id, input.userId);

const rows = await db
.delete(schema.cvmateAward)
.where(
and(
eq(schema.cvmateAward.id, input.id),
eq(schema.cvmateAward.masterProfileId, award.masterProfileId),
),
)
.returning({ id: schema.cvmateAward.id });

if (rows.length === 0) throw new ORPCError("NOT_FOUND");
},

createReference: async (input: ReferenceFields & { userId: string }) => {
const { userId, ...fields } = input;
const profile = await ensureProfile(userId);

const [reference] = await db
.insert(schema.cvmateReference)
.values({
id: generateId(),
masterProfileId: profile.id,
...fields,
})
.returning();

if (!reference) throw new Error("CVMATE_REFERENCE_CREATE_FAILED");

return reference;
},

updateReference: async (
input: ReferenceFields & {
id: string;
userId: string;
},
) => {
const { reference } = await requireOwnedReference(input.id, input.userId);
const { id, userId, ...fields } = input;

const merged = {
name: fields.name !== undefined ? fields.name : reference.name,
issuer: fields.issuer !== undefined ? fields.issuer : reference.issuer,
date: fields.date !== undefined ? fields.date : reference.date,
description:
fields.description !== undefined
? fields.description
: reference.description,
};

if (!hasReferenceContent(merged)) {
throw new ORPCError("BAD_REQUEST", {
message: "Reference must contain at least one non-empty business field.",
});
}

const [updated] = await db
.update(schema.cvmateReference)
.set(fields)
.where(
and(
eq(schema.cvmateReference.id, id),
eq(schema.cvmateReference.masterProfileId, reference.masterProfileId),
),
)
.returning();

if (!updated) throw new ORPCError("NOT_FOUND");

return updated;
},

deleteReference: async (input: { id: string; userId: string }) => {
const { reference } = await requireOwnedReference(input.id, input.userId);

const rows = await db
.delete(schema.cvmateReference)
.where(
and(
eq(schema.cvmateReference.id, input.id),
eq(schema.cvmateReference.masterProfileId, reference.masterProfileId),
),
)
.returning({ id: schema.cvmateReference.id });

if (rows.length === 0) throw new ORPCError("NOT_FOUND");
},

createLicense: async (input: LicenseFields & { userId: string }) => {
const { userId, ...fields } = input;
const profile = await ensureProfile(userId);

const [license] = await db
.insert(schema.cvmateLicense)
.values({
id: generateId(),
masterProfileId: profile.id,
...fields,
})
.returning();

if (!license) throw new Error("CVMATE_LICENSE_CREATE_FAILED");

return license;
},

updateLicense: async (
input: LicenseFields & {
id: string;
userId: string;
},
) => {
const { license } = await requireOwnedLicense(input.id, input.userId);
const { id, userId, ...fields } = input;

const merged = {
name: fields.name !== undefined ? fields.name : license.name,
date: fields.date !== undefined ? fields.date : license.date,
description:
fields.description !== undefined ? fields.description : license.description,
};

if (!hasLicenseContent(merged)) {
throw new ORPCError("BAD_REQUEST", {
message: "License must contain at least one non-empty business field.",
});
}

const [updated] = await db
.update(schema.cvmateLicense)
.set(fields)
.where(
and(
eq(schema.cvmateLicense.id, id),
eq(schema.cvmateLicense.masterProfileId, license.masterProfileId),
),
)
.returning();

if (!updated) throw new ORPCError("NOT_FOUND");

return updated;
},

deleteLicense: async (input: { id: string; userId: string }) => {
const { license } = await requireOwnedLicense(input.id, input.userId);

const rows = await db
.delete(schema.cvmateLicense)
.where(
and(
eq(schema.cvmateLicense.id, input.id),
eq(schema.cvmateLicense.masterProfileId, license.masterProfileId),
),
)
.returning({ id: schema.cvmateLicense.id });

if (rows.length === 0) throw new ORPCError("NOT_FOUND");
},

upsertClause: async (input: ClauseFields & { userId: string }) => {
const profile = await ensureProfile(input.userId);

const insertValues = {
id: generateId(),
masterProfileId: profile.id,
scope: input.scope,
language: input.language,
...(input.isEnabled !== undefined
? { isEnabled: input.isEnabled }
: {}),
...(input.content !== undefined
? { content: input.content }
: {}),
};

const updateValues = {
...(input.isEnabled !== undefined
? { isEnabled: input.isEnabled }
: {}),
...(input.content !== undefined
? { content: input.content }
: {}),
};

const [clause] = await db
.insert(schema.cvmateClause)
.values(insertValues)
.onConflictDoUpdate({
target: [
schema.cvmateClause.masterProfileId,
schema.cvmateClause.scope,
schema.cvmateClause.language,
],
set: updateValues,
})
.returning();

if (!clause) throw new Error("CVMATE_CLAUSE_UPSERT_FAILED");

return clause;
},

deleteClause: async (input: {
userId: string;
scope: ClauseScope;
language: ClauseLanguage;
}) => {
const profile = await requireCurrentProfile(input.userId);

const rows = await db
.delete(schema.cvmateClause)
.where(
and(
eq(schema.cvmateClause.masterProfileId, profile.id),
eq(schema.cvmateClause.scope, input.scope),
eq(schema.cvmateClause.language, input.language),
),
)
.returning({ id: schema.cvmateClause.id });

if (rows.length === 0) throw new ORPCError("NOT_FOUND");
},

createCustomSection: async (input: {
userId: string;
title: string;
isVisible?: boolean | undefined;
sortOrder?: number | undefined;
}) => {
const profile = await ensureProfile(input.userId);

const [section] = await db
.insert(schema.cvmateProfileSection)
.values({
id: generateId(),
masterProfileId: profile.id,
kind: "custom",
title: input.title,
...(input.isVisible !== undefined
? { isVisible: input.isVisible }
: {}),
...(input.sortOrder !== undefined
? { sortOrder: input.sortOrder }
: {}),
})
.returning();

if (!section) throw new Error("CVMATE_CUSTOM_SECTION_CREATE_FAILED");

return section;
},

updateCustomSection: async (input: {
id: string;
userId: string;
title?: string | undefined;
isVisible?: boolean | undefined;
sortOrder?: number | undefined;
}) => {
const { section } = await requireOwnedCustomSection(
input.id,
input.userId,
);
const { id, userId, ...fields } = input;

const [updated] = await db
.update(schema.cvmateProfileSection)
.set(fields)
.where(
and(
eq(schema.cvmateProfileSection.id, id),
eq(
schema.cvmateProfileSection.masterProfileId,
section.masterProfileId,
),
eq(schema.cvmateProfileSection.kind, "custom"),
),
)
.returning();

if (!updated) throw new ORPCError("NOT_FOUND");

return updated;
},

deleteCustomSection: async (input: { id: string; userId: string }) => {
const { section } = await requireOwnedCustomSection(
input.id,
input.userId,
);

const rows = await db
.delete(schema.cvmateProfileSection)
.where(
and(
eq(schema.cvmateProfileSection.id, input.id),
eq(
schema.cvmateProfileSection.masterProfileId,
section.masterProfileId,
),
eq(schema.cvmateProfileSection.kind, "custom"),
),
)
.returning({ id: schema.cvmateProfileSection.id });

if (rows.length === 0) throw new ORPCError("NOT_FOUND");
},

createCustomSectionItem: async (
input: CustomSectionItemFields & {
userId: string;
profileSectionId: string;
},
) => {
const { userId, profileSectionId, ...fields } = input;

await requireOwnedCustomSection(profileSectionId, userId);

const businessFields = {
title: fields.title ?? null,
subtitle: fields.subtitle ?? null,
date: fields.date ?? null,
description: fields.description ?? null,
url: fields.url ?? null,
fields: fields.fields ?? null,
};

if (!hasCustomSectionItemContent(businessFields)) {
throw new ORPCError("BAD_REQUEST", {
message:
"Custom section item must contain at least one non-empty business field.",
});
}

const [item] = await db
.insert(schema.cvmateCustomSectionItem)
.values({
id: generateId(),
profileSectionId,
...fields,
})
.returning();

if (!item) throw new Error("CVMATE_CUSTOM_SECTION_ITEM_CREATE_FAILED");

return item;
},

updateCustomSectionItem: async (
input: CustomSectionItemFields & {
id: string;
userId: string;
},
) => {
const { item } = await requireOwnedCustomSectionItem(
input.id,
input.userId,
);
const { id, userId, ...fields } = input;

const merged = {
title: fields.title !== undefined ? fields.title : item.title,
subtitle:
fields.subtitle !== undefined ? fields.subtitle : item.subtitle,
date: fields.date !== undefined ? fields.date : item.date,
description:
fields.description !== undefined
? fields.description
: item.description,
url: fields.url !== undefined ? fields.url : item.url,
fields: fields.fields !== undefined ? fields.fields : item.fields,
};

if (!hasCustomSectionItemContent(merged)) {
throw new ORPCError("BAD_REQUEST", {
message:
"Custom section item must contain at least one non-empty business field.",
});
}

const [updated] = await db
.update(schema.cvmateCustomSectionItem)
.set(fields)
.where(
and(
eq(schema.cvmateCustomSectionItem.id, id),
eq(
schema.cvmateCustomSectionItem.profileSectionId,
item.profileSectionId,
),
),
)
.returning();

if (!updated) throw new ORPCError("NOT_FOUND");

return updated;
},

deleteCustomSectionItem: async (input: {
id: string;
userId: string;
}) => {
const { item } = await requireOwnedCustomSectionItem(
input.id,
input.userId,
);

const rows = await db
.delete(schema.cvmateCustomSectionItem)
.where(
and(
eq(schema.cvmateCustomSectionItem.id, input.id),
eq(
schema.cvmateCustomSectionItem.profileSectionId,
item.profileSectionId,
),
),
)
.returning({ id: schema.cvmateCustomSectionItem.id });

if (rows.length === 0) throw new ORPCError("NOT_FOUND");
},
};
