import { createSelectSchema } from "drizzle-zod";
import z from "zod";
import * as schema from "@reactive-resume/db/schema";

const trimmedNullableString = z.string().trim().nullable();
const nonBlankString = z.string().trim().min(1);

const httpUrlSchema = z
.string()
.trim()
.pipe(z.url({ protocol: /^https?$/, error: "URL must use http or https." }));

const partialDateSchema = z
.string()
.regex(/^\d{4}(?:-\d{2})?(?:-\d{2})?$/, "Date must use YYYY, YYYY-MM, or YYYY-MM-DD format.")
.refine((value) => {
const parts = value.split("-").map(Number);
const [year, month, day] = parts;

if (!year) return false;
if (parts.length === 1) return true;

if (!month || month < 1 || month > 12) return false;
if (parts.length === 2) return true;

if (!day) return false;

const parsed = new Date(Date.UTC(year, month - 1, day));

return (
parsed.getUTCFullYear() === year &&
parsed.getUTCMonth() === month - 1 &&
parsed.getUTCDate() === day
);
})
.describe("A partial calendar date using YYYY, YYYY-MM, or YYYY-MM-DD.");

const nullablePartialDateSchema = partialDateSchema.nullable();

const profileSectionKindSchema = z.enum([
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
"custom",
]);

const profileListItemKindSchema = z.enum(["competency", "software", "tool", "interest"]);
const clauseScopeSchema = z.enum(["current", "future"]);
const clauseLanguageSchema = z.enum(["pl", "en"]);

const masterProfileSchema = createSelectSchema(schema.cvmateMasterProfile, {
id: z.string(),
userId: z.string(),
firstName: trimmedNullableString,
lastName: trimmedNullableString,
email: trimmedNullableString,
phone: trimmedNullableString,
location: trimmedNullableString,
linkedinUrl: httpUrlSchema.nullable(),
websiteUrl: httpUrlSchema.nullable(),
createdAt: z.date(),
updatedAt: z.date(),
});

const profileSectionSchema = createSelectSchema(schema.cvmateProfileSection, {
id: z.string(),
masterProfileId: z.string(),
kind: profileSectionKindSchema,
title: z.string().trim(),
isVisible: z.boolean(),
sortOrder: z.number().int(),
createdAt: z.date(),
updatedAt: z.date(),
});

const employmentSchema = createSelectSchema(schema.cvmateEmployment, {
id: z.string(),
masterProfileId: z.string(),
company: trimmedNullableString,
jobTitle: trimmedNullableString,
location: trimmedNullableString,
startDate: nullablePartialDateSchema,
endDate: nullablePartialDateSchema,
isCurrent: z.boolean(),
sortOrder: z.number().int(),
createdAt: z.date(),
updatedAt: z.date(),
});

const experienceFactSchema = createSelectSchema(schema.cvmateExperienceFact, {
id: z.string(),
masterProfileId: z.string(),
text: nonBlankString,
createdAt: z.date(),
updatedAt: z.date(),
});

const employmentFactSchema = createSelectSchema(schema.cvmateEmploymentFact, {
employmentId: z.string(),
experienceFactId: z.string(),
masterProfileId: z.string(),
sortOrder: z.number().int(),
createdAt: z.date(),
});

const profileListItemSchema = createSelectSchema(schema.cvmateProfileListItem, {
id: z.string(),
masterProfileId: z.string(),
kind: profileListItemKindSchema,
value: nonBlankString,
sortOrder: z.number().int(),
createdAt: z.date(),
updatedAt: z.date(),
});

const projectSchema = createSelectSchema(schema.cvmateProject, {
id: z.string(),
masterProfileId: z.string(),
name: trimmedNullableString,
company: trimmedNullableString,
startDate: nullablePartialDateSchema,
endDate: nullablePartialDateSchema,
description: trimmedNullableString,
sortOrder: z.number().int(),
createdAt: z.date(),
updatedAt: z.date(),
});

const educationSchema = createSelectSchema(schema.cvmateEducation, {
id: z.string(),
masterProfileId: z.string(),
institution: trimmedNullableString,
fieldOfStudy: trimmedNullableString,
specialization: trimmedNullableString,
degree: trimmedNullableString,
startDate: nullablePartialDateSchema,
endDate: nullablePartialDateSchema,
description: trimmedNullableString,
sortOrder: z.number().int(),
createdAt: z.date(),
updatedAt: z.date(),
});

const courseSchema = createSelectSchema(schema.cvmateCourse, {
id: z.string(),
masterProfileId: z.string(),
name: trimmedNullableString,
organizer: trimmedNullableString,
date: nullablePartialDateSchema,
description: trimmedNullableString,
sortOrder: z.number().int(),
createdAt: z.date(),
updatedAt: z.date(),
});

const certificationSchema = createSelectSchema(schema.cvmateCertification, {
id: z.string(),
masterProfileId: z.string(),
name: trimmedNullableString,
issuingOrganization: trimmedNullableString,
issueDate: nullablePartialDateSchema,
expiryDate: nullablePartialDateSchema,
credentialNumber: trimmedNullableString,
credentialUrl: httpUrlSchema.nullable(),
description: trimmedNullableString,
sortOrder: z.number().int(),
createdAt: z.date(),
updatedAt: z.date(),
});

const volunteerSchema = createSelectSchema(schema.cvmateVolunteer, {
id: z.string(),
masterProfileId: z.string(),
organization: trimmedNullableString,
role: trimmedNullableString,
date: nullablePartialDateSchema,
description: trimmedNullableString,
sortOrder: z.number().int(),
createdAt: z.date(),
updatedAt: z.date(),
});

const languageSchema = createSelectSchema(schema.cvmateLanguage, {
id: z.string(),
masterProfileId: z.string(),
language: trimmedNullableString,
level: trimmedNullableString,
sortOrder: z.number().int(),
createdAt: z.date(),
updatedAt: z.date(),
});

const awardSchema = createSelectSchema(schema.cvmateAward, {
id: z.string(),
masterProfileId: z.string(),
name: trimmedNullableString,
organizer: trimmedNullableString,
date: nullablePartialDateSchema,
description: trimmedNullableString,
sortOrder: z.number().int(),
createdAt: z.date(),
updatedAt: z.date(),
});

const referenceSchema = createSelectSchema(schema.cvmateReference, {
id: z.string(),
masterProfileId: z.string(),
name: trimmedNullableString,
issuer: trimmedNullableString,
date: nullablePartialDateSchema,
description: trimmedNullableString,
sortOrder: z.number().int(),
createdAt: z.date(),
updatedAt: z.date(),
});

const licenseSchema = createSelectSchema(schema.cvmateLicense, {
id: z.string(),
masterProfileId: z.string(),
name: trimmedNullableString,
date: nullablePartialDateSchema,
description: trimmedNullableString,
sortOrder: z.number().int(),
createdAt: z.date(),
updatedAt: z.date(),
});

const clauseSchema = createSelectSchema(schema.cvmateClause, {
id: z.string(),
masterProfileId: z.string(),
scope: clauseScopeSchema,
language: clauseLanguageSchema,
isEnabled: z.boolean(),
content: trimmedNullableString,
createdAt: z.date(),
updatedAt: z.date(),
});

const customSectionItemSchema = createSelectSchema(schema.cvmateCustomSectionItem, {
id: z.string(),
profileSectionId: z.string(),
title: trimmedNullableString,
subtitle: trimmedNullableString,
date: nullablePartialDateSchema,
description: trimmedNullableString,
url: httpUrlSchema.nullable(),
fields: z.record(z.string(), z.unknown()).nullable(),
sortOrder: z.number().int(),
createdAt: z.date(),
updatedAt: z.date(),
});

const profilePhotoSchema = createSelectSchema(schema.cvmateProfilePhoto, {
id: z.string(),
masterProfileId: z.string(),
storageKey: nonBlankString,
filename: nonBlankString,
mediaType: nonBlankString,
size: z.number().int().nonnegative(),
width: z.number().int().positive().nullable(),
height: z.number().int().positive().nullable(),
label: trimmedNullableString,
sortOrder: z.number().int(),
createdAt: z.date(),
updatedAt: z.date(),
});

const masterProfilePublicSchema = masterProfileSchema.omit({ userId: true });

const aggregateSchema = z.object({
profile: masterProfilePublicSchema,
sections: z.array(profileSectionSchema),
employments: z.array(employmentSchema),
experienceFacts: z.array(experienceFactSchema),
employmentFacts: z.array(employmentFactSchema),
listItems: z.array(profileListItemSchema),
projects: z.array(projectSchema),
education: z.array(educationSchema),
courses: z.array(courseSchema),
certifications: z.array(certificationSchema),
volunteer: z.array(volunteerSchema),
languages: z.array(languageSchema),
awards: z.array(awardSchema),
references: z.array(referenceSchema),
licenses: z.array(licenseSchema),
clauses: z.array(clauseSchema),
customSectionItems: z.array(customSectionItemSchema),
photos: z.array(profilePhotoSchema),
});

const basicsEditableSchema = masterProfileSchema
.pick({
firstName: true,
lastName: true,
email: true,
phone: true,
location: true,
linkedinUrl: true,
websiteUrl: true,
})
.partial();

const basicsUpdateSchema = basicsEditableSchema.refine(
(value) => Object.values(value).some((field) => field !== undefined),
"Provide at least one field to update.",
);

const employmentEditableSchema = employmentSchema
.pick({
company: true,
jobTitle: true,
location: true,
startDate: true,
endDate: true,
isCurrent: true,
sortOrder: true,
})
.partial();

const hasEmploymentContent = (value: z.infer<typeof employmentEditableSchema>) =>
[value.company, value.jobTitle, value.location, value.startDate, value.endDate].some(
(field) => typeof field === "string" && field.trim().length > 0,
);

const employmentCreateSchema = employmentEditableSchema.refine(
hasEmploymentContent,
"Employment must contain at least one non-empty business field.",
);

const projectEditableSchema = projectSchema
.pick({
name: true,
company: true,
startDate: true,
endDate: true,
description: true,
sortOrder: true,
})
.partial();

const hasProjectContent = (value: z.infer<typeof projectEditableSchema>) =>
[value.name, value.company, value.startDate, value.endDate, value.description].some(
(field) => typeof field === "string" && field.trim().length > 0,
);

const projectCreateSchema = projectEditableSchema.refine(
hasProjectContent,
"Project must contain at least one non-empty business field.",
);

const educationEditableSchema = educationSchema
.pick({
institution: true,
fieldOfStudy: true,
specialization: true,
degree: true,
startDate: true,
endDate: true,
description: true,
sortOrder: true,
})
.partial();

const hasEducationContent = (value: z.infer<typeof educationEditableSchema>) =>
[
value.institution,
value.fieldOfStudy,
value.specialization,
value.degree,
value.startDate,
value.endDate,
value.description,
].some((field) => typeof field === "string" && field.trim().length > 0);

const educationCreateSchema = educationEditableSchema.refine(
hasEducationContent,
"Education must contain at least one non-empty business field.",
);

const courseEditableSchema = courseSchema
.pick({
name: true,
organizer: true,
date: true,
description: true,
sortOrder: true,
})
.partial();

const hasCourseContent = (value: z.infer<typeof courseEditableSchema>) =>
[value.name, value.organizer, value.date, value.description].some(
(field) => typeof field === "string" && field.trim().length > 0,
);

const courseCreateSchema = courseEditableSchema.refine(
hasCourseContent,
"Course must contain at least one non-empty business field.",
);

const certificationEditableSchema = certificationSchema
.pick({
name: true,
issuingOrganization: true,
issueDate: true,
expiryDate: true,
credentialNumber: true,
credentialUrl: true,
description: true,
sortOrder: true,
})
.partial();

const hasCertificationContent = (
value: z.infer<typeof certificationEditableSchema>,
) =>
[
value.name,
value.issuingOrganization,
value.issueDate,
value.expiryDate,
value.credentialNumber,
value.credentialUrl,
value.description,
].some((field) => typeof field === "string" && field.trim().length > 0);

const certificationCreateSchema = certificationEditableSchema.refine(
hasCertificationContent,
"Certification must contain at least one non-empty business field.",
);

const volunteerEditableSchema = volunteerSchema
.pick({
organization: true,
role: true,
date: true,
description: true,
sortOrder: true,
})
.partial();

const hasVolunteerContent = (value: z.infer<typeof volunteerEditableSchema>) =>
[value.organization, value.role, value.date, value.description].some(
(field) => typeof field === "string" && field.trim().length > 0,
);

const volunteerCreateSchema = volunteerEditableSchema.refine(
hasVolunteerContent,
"Volunteer record must contain at least one non-empty business field.",
);

const languageEditableSchema = languageSchema
.pick({
language: true,
level: true,
sortOrder: true,
})
.partial();

const hasLanguageContent = (value: z.infer<typeof languageEditableSchema>) =>
[value.language, value.level].some(
(field) => typeof field === "string" && field.trim().length > 0,
);

const languageCreateSchema = languageEditableSchema.refine(
hasLanguageContent,
"Language record must contain at least one non-empty business field.",
);

const awardEditableSchema = awardSchema
.pick({
name: true,
organizer: true,
date: true,
description: true,
sortOrder: true,
})
.partial();

const hasAwardContent = (value: z.infer<typeof awardEditableSchema>) =>
[value.name, value.organizer, value.date, value.description].some(
(field) => typeof field === "string" && field.trim().length > 0,
);

const awardCreateSchema = awardEditableSchema.refine(
hasAwardContent,
"Award must contain at least one non-empty business field.",
);

const referenceEditableSchema = referenceSchema
.pick({
name: true,
issuer: true,
date: true,
description: true,
sortOrder: true,
})
.partial();

const hasReferenceContent = (value: z.infer<typeof referenceEditableSchema>) =>
[value.name, value.issuer, value.date, value.description].some(
(field) => typeof field === "string" && field.trim().length > 0,
);

const referenceCreateSchema = referenceEditableSchema.refine(
hasReferenceContent,
"Reference must contain at least one non-empty business field.",
);

const licenseEditableSchema = licenseSchema
.pick({
name: true,
date: true,
description: true,
sortOrder: true,
})
.partial();

const hasLicenseContent = (value: z.infer<typeof licenseEditableSchema>) =>
[value.name, value.date, value.description].some(
(field) => typeof field === "string" && field.trim().length > 0,
);

const licenseCreateSchema = licenseEditableSchema.refine(
hasLicenseContent,
"License must contain at least one non-empty business field.",
);

const clauseUpsertSchema = z
.object({
scope: clauseScopeSchema,
language: clauseLanguageSchema,
isEnabled: z.boolean().optional(),
content: trimmedNullableString.optional(),
})
.refine(
(value) => value.isEnabled !== undefined || value.content !== undefined,
"Provide at least one clause field to save.",
);
export const cvmateProfileDto = {
getCurrent: {
input: z.object({}).optional().default({}),
output: aggregateSchema.nullable(),
},

updateBasics: {
input: basicsUpdateSchema,
output: masterProfilePublicSchema,
},

createEmployment: {
input: employmentCreateSchema,
output: employmentSchema,
},

updateEmployment: {
input: employmentEditableSchema
.extend({ id: z.string() })
.refine(
(value) =>
Object.entries(value).some(
([key, field]) => key !== "id" && field !== undefined,
),
"Provide at least one field to update.",
),
output: employmentSchema,
},

deleteEmployment: {
input: z.object({ id: z.string() }),
output: z.void(),
},

createExperienceFact: {
input: z.object({ text: experienceFactSchema.shape.text }),
output: experienceFactSchema,
},

updateExperienceFact: {
input: z.object({
id: z.string(),
text: experienceFactSchema.shape.text,
}),
output: experienceFactSchema,
},

deleteExperienceFact: {
input: z.object({ id: z.string() }),
output: z.void(),
},

linkEmploymentFact: {
input: z.object({
employmentId: z.string(),
experienceFactId: z.string(),
sortOrder: z.number().int().optional(),
}),
output: employmentFactSchema,
},

unlinkEmploymentFact: {
input: z.object({
employmentId: z.string(),
experienceFactId: z.string(),
}),
output: z.void(),
},

createListItem: {
input: z.object({
kind: profileListItemKindSchema,
value: nonBlankString,
sortOrder: z.number().int().optional(),
}),
output: profileListItemSchema,
},

updateListItem: {
input: z
.object({
id: z.string(),
value: nonBlankString.optional(),
sortOrder: z.number().int().optional(),
})
.refine(
(value) => value.value !== undefined || value.sortOrder !== undefined,
"Provide at least one field to update.",
),
output: profileListItemSchema,
},

deleteListItem: {
input: z.object({ id: z.string() }),
output: z.void(),
},

createProject: {
input: projectCreateSchema,
output: projectSchema,
},

updateProject: {
input: projectEditableSchema
.extend({ id: z.string() })
.refine(
(value) =>
Object.entries(value).some(
([key, field]) => key !== "id" && field !== undefined,
),
"Provide at least one field to update.",
),
output: projectSchema,
},

deleteProject: {
input: z.object({ id: z.string() }),
output: z.void(),
},

createEducation: {
input: educationCreateSchema,
output: educationSchema,
},

updateEducation: {
input: educationEditableSchema
.extend({ id: z.string() })
.refine(
(value) =>
Object.entries(value).some(
([key, field]) => key !== "id" && field !== undefined,
),
"Provide at least one field to update.",
),
output: educationSchema,
},

deleteEducation: {
input: z.object({ id: z.string() }),
output: z.void(),
},

createCourse: {
input: courseCreateSchema,
output: courseSchema,
},

updateCourse: {
input: courseEditableSchema
.extend({ id: z.string() })
.refine(
(value) =>
Object.entries(value).some(
([key, field]) => key !== "id" && field !== undefined,
),
"Provide at least one field to update.",
),
output: courseSchema,
},

deleteCourse: {
input: z.object({ id: z.string() }),
output: z.void(),
},

createCertification: {
input: certificationCreateSchema,
output: certificationSchema,
},

updateCertification: {
input: certificationEditableSchema
.extend({ id: z.string() })
.refine(
(value) =>
Object.entries(value).some(
([key, field]) => key !== "id" && field !== undefined,
),
"Provide at least one field to update.",
),
output: certificationSchema,
},

deleteCertification: {
input: z.object({ id: z.string() }),
output: z.void(),
},

createVolunteer: {
input: volunteerCreateSchema,
output: volunteerSchema,
},

updateVolunteer: {
input: volunteerEditableSchema
.extend({ id: z.string() })
.refine(
(value) =>
Object.entries(value).some(
([key, field]) => key !== "id" && field !== undefined,
),
"Provide at least one field to update.",
),
output: volunteerSchema,
},

deleteVolunteer: {
input: z.object({ id: z.string() }),
output: z.void(),
},

createLanguage: {
input: languageCreateSchema,
output: languageSchema,
},

updateLanguage: {
input: languageEditableSchema
.extend({ id: z.string() })
.refine(
(value) =>
Object.entries(value).some(
([key, field]) => key !== "id" && field !== undefined,
),
"Provide at least one field to update.",
),
output: languageSchema,
},

deleteLanguage: {
input: z.object({ id: z.string() }),
output: z.void(),
},

createAward: {
input: awardCreateSchema,
output: awardSchema,
},

updateAward: {
input: awardEditableSchema
.extend({ id: z.string() })
.refine(
(value) =>
Object.entries(value).some(
([key, field]) => key !== "id" && field !== undefined,
),
"Provide at least one field to update.",
),
output: awardSchema,
},

deleteAward: {
input: z.object({ id: z.string() }),
output: z.void(),
},

createReference: {
input: referenceCreateSchema,
output: referenceSchema,
},

updateReference: {
input: referenceEditableSchema
.extend({ id: z.string() })
.refine(
(value) =>
Object.entries(value).some(
([key, field]) => key !== "id" && field !== undefined,
),
"Provide at least one field to update.",
),
output: referenceSchema,
},

deleteReference: {
input: z.object({ id: z.string() }),
output: z.void(),
},

createLicense: {
input: licenseCreateSchema,
output: licenseSchema,
},

updateLicense: {
input: licenseEditableSchema
.extend({ id: z.string() })
.refine(
(value) =>
Object.entries(value).some(
([key, field]) => key !== "id" && field !== undefined,
),
"Provide at least one field to update.",
),
output: licenseSchema,
},

deleteLicense: {
input: z.object({ id: z.string() }),
output: z.void(),
},

upsertClause: {
input: clauseUpsertSchema,
output: clauseSchema,
},

deleteClause: {
input: z.object({
scope: clauseScopeSchema,
language: clauseLanguageSchema,
}),
output: z.void(),
},
};

export {

aggregateSchema as cvmateMasterProfileAggregateSchema,
clauseLanguageSchema as cvmateClauseLanguageSchema,
clauseScopeSchema as cvmateClauseScopeSchema,
partialDateSchema as cvmatePartialDateSchema,
profileListItemKindSchema as cvmateProfileListItemKindSchema,
profileSectionKindSchema as cvmateProfileSectionKindSchema,
};
