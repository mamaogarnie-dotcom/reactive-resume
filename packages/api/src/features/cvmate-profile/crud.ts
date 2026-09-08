import { protectedProcedure } from "../../context";
import { cvmateProfileDto } from "../../dto/cvmate-profile";
import { resumeMutationRateLimit } from "../../middleware/rate-limit";
import { cvmateProfileService } from "./service";

export const crudRouter = {
getCurrent: protectedProcedure
.route({
method: "GET",
path: "/cvmate/profile",
tags: ["CVMate Profile"],
operationId: "getCvmateProfile",
summary: "Get current Master Profile",
description:
"Returns the authenticated user's CVMate Master Profile together with its related profile data. Returns null when the user has not created a Master Profile yet. Requires authentication.",
successDescription: "The current CVMate Master Profile, or null if none exists.",
})
.input(cvmateProfileDto.getCurrent.input)
.output(cvmateProfileDto.getCurrent.output)
.handler(({ context }) =>
cvmateProfileService.getCurrent({ userId: context.user.id }),
),

updateBasics: protectedProcedure
.route({
method: "PUT",
path: "/cvmate/profile/basics",
tags: ["CVMate Profile"],
operationId: "updateCvmateProfileBasics",
summary: "Update Master Profile basics",
description:
"Updates basic personal and contact information in the authenticated user's CVMate Master Profile. The Master Profile is created lazily on the first write. Requires authentication.",
successDescription: "The updated Master Profile basics.",
})
.input(cvmateProfileDto.updateBasics.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.updateBasics.output)
.handler(({ input, context }) =>
cvmateProfileService.updateBasics({
userId: context.user.id,
...input,
}),
),

createEmployment: protectedProcedure
.route({
method: "POST",
path: "/cvmate/profile/employments",
tags: ["CVMate Profile"],
operationId: "createCvmateEmployment",
summary: "Create employment",
description:
"Adds an employment record to the authenticated user's CVMate Master Profile. The record must contain at least one non-empty business field. Requires authentication.",
successDescription: "The created employment record.",
})
.input(cvmateProfileDto.createEmployment.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.createEmployment.output)
.handler(({ input, context }) =>
cvmateProfileService.createEmployment({
userId: context.user.id,
...input,
}),
),

updateEmployment: protectedProcedure
.route({
method: "PUT",
path: "/cvmate/profile/employments/{id}",
tags: ["CVMate Profile"],
operationId: "updateCvmateEmployment",
summary: "Update employment",
description:
"Updates an employment record belonging to the authenticated user's CVMate Master Profile. An update cannot leave the record entirely empty. Requires authentication.",
successDescription: "The updated employment record.",
})
.input(cvmateProfileDto.updateEmployment.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.updateEmployment.output)
.handler(({ input, context }) =>
cvmateProfileService.updateEmployment({
userId: context.user.id,
...input,
}),
),

deleteEmployment: protectedProcedure
.route({
method: "DELETE",
path: "/cvmate/profile/employments/{id}",
tags: ["CVMate Profile"],
operationId: "deleteCvmateEmployment",
summary: "Delete employment",
description:
"Deletes an employment record belonging to the authenticated user's CVMate Master Profile. Requires authentication.",
successDescription: "The employment record was deleted.",
})
.input(cvmateProfileDto.deleteEmployment.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.deleteEmployment.output)
.handler(({ input, context }) =>
cvmateProfileService.deleteEmployment({
id: input.id,
userId: context.user.id,
}),
),

createExperienceFact: protectedProcedure
.route({
method: "POST",
path: "/cvmate/profile/experience-facts",
tags: ["CVMate Profile"],
operationId: "createCvmateExperienceFact",
summary: "Create experience fact",
description:
"Adds a reusable factual experience statement to the authenticated user's CVMate Master Profile. Requires authentication.",
successDescription: "The created experience fact.",
})
.input(cvmateProfileDto.createExperienceFact.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.createExperienceFact.output)
.handler(({ input, context }) =>
cvmateProfileService.createExperienceFact({
userId: context.user.id,
text: input.text,
}),
),

updateExperienceFact: protectedProcedure
.route({
method: "PUT",
path: "/cvmate/profile/experience-facts/{id}",
tags: ["CVMate Profile"],
operationId: "updateCvmateExperienceFact",
summary: "Update experience fact",
description:
"Updates a reusable experience fact belonging to the authenticated user's CVMate Master Profile. Requires authentication.",
successDescription: "The updated experience fact.",
})
.input(cvmateProfileDto.updateExperienceFact.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.updateExperienceFact.output)
.handler(({ input, context }) =>
cvmateProfileService.updateExperienceFact({
id: input.id,
userId: context.user.id,
text: input.text,
}),
),

deleteExperienceFact: protectedProcedure
.route({
method: "DELETE",
path: "/cvmate/profile/experience-facts/{id}",
tags: ["CVMate Profile"],
operationId: "deleteCvmateExperienceFact",
summary: "Delete experience fact",
description:
"Deletes a reusable experience fact belonging to the authenticated user's CVMate Master Profile. Requires authentication.",
successDescription: "The experience fact was deleted.",
})
.input(cvmateProfileDto.deleteExperienceFact.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.deleteExperienceFact.output)
.handler(({ input, context }) =>
cvmateProfileService.deleteExperienceFact({
id: input.id,
userId: context.user.id,
}),
),

linkEmploymentFact: protectedProcedure
.route({
method: "PUT",
path: "/cvmate/profile/employments/{employmentId}/facts/{experienceFactId}",
tags: ["CVMate Profile"],
operationId: "linkCvmateEmploymentFact",
summary: "Link experience fact to employment",
description:
"Links an existing experience fact to an employment record in the same authenticated user's CVMate Master Profile. Repeating the request is safe and may update the link sort order. Requires authentication.",
successDescription: "The employment-to-fact link.",
})
.input(cvmateProfileDto.linkEmploymentFact.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.linkEmploymentFact.output)
.handler(({ input, context }) =>
cvmateProfileService.linkEmploymentFact({
userId: context.user.id,
employmentId: input.employmentId,
experienceFactId: input.experienceFactId,
...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
}),
),

unlinkEmploymentFact: protectedProcedure
.route({
method: "DELETE",
path: "/cvmate/profile/employments/{employmentId}/facts/{experienceFactId}",
tags: ["CVMate Profile"],
operationId: "unlinkCvmateEmploymentFact",
summary: "Unlink experience fact from employment",
description:
"Removes the link between an employment record and an experience fact in the authenticated user's CVMate Master Profile. Requires authentication.",
successDescription: "The employment-to-fact link was removed.",
})
.input(cvmateProfileDto.unlinkEmploymentFact.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.unlinkEmploymentFact.output)
.handler(({ input, context }) =>
cvmateProfileService.unlinkEmploymentFact({
userId: context.user.id,
employmentId: input.employmentId,
experienceFactId: input.experienceFactId,
}),
),

createListItem: protectedProcedure
.route({
method: "POST",
path: "/cvmate/profile/list-items",
tags: ["CVMate Profile"],
operationId: "createCvmateProfileListItem",
summary: "Create profile list item",
description:
"Adds a competency, software item, tool, or interest to the authenticated user's CVMate Master Profile. Requires authentication.",
successDescription: "The created profile list item.",
})
.input(cvmateProfileDto.createListItem.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.createListItem.output)
.handler(({ input, context }) =>
cvmateProfileService.createListItem({
userId: context.user.id,
kind: input.kind,
value: input.value,
...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
}),
),

updateListItem: protectedProcedure
.route({
method: "PUT",
path: "/cvmate/profile/list-items/{id}",
tags: ["CVMate Profile"],
operationId: "updateCvmateProfileListItem",
summary: "Update profile list item",
description:
"Updates a competency, software item, tool, or interest belonging to the authenticated user's CVMate Master Profile. Requires authentication.",
successDescription: "The updated profile list item.",
})
.input(cvmateProfileDto.updateListItem.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.updateListItem.output)
.handler(({ input, context }) =>
cvmateProfileService.updateListItem({
id: input.id,
userId: context.user.id,
...(input.value !== undefined ? { value: input.value } : {}),
...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
}),
),

deleteListItem: protectedProcedure
.route({
method: "DELETE",
path: "/cvmate/profile/list-items/{id}",
tags: ["CVMate Profile"],
operationId: "deleteCvmateProfileListItem",
summary: "Delete profile list item",
description:
"Deletes a competency, software item, tool, or interest belonging to the authenticated user's CVMate Master Profile. Requires authentication.",
successDescription: "The profile list item was deleted.",
})
.input(cvmateProfileDto.deleteListItem.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.deleteListItem.output)
.handler(({ input, context }) =>
cvmateProfileService.deleteListItem({
id: input.id,
userId: context.user.id,
}),
),

createProject: protectedProcedure
.route({
method: "POST",
path: "/cvmate/profile/projects",
tags: ["CVMate Profile"],
operationId: "createCvmateProject",
summary: "Create project",
description:
"Adds a project to the authenticated user's CVMate Master Profile. The record must contain at least one non-empty business field. Requires authentication.",
successDescription: "The created project.",
})
.input(cvmateProfileDto.createProject.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.createProject.output)
.handler(({ input, context }) =>
cvmateProfileService.createProject({
userId: context.user.id,
...input,
}),
),

updateProject: protectedProcedure
.route({
method: "PUT",
path: "/cvmate/profile/projects/{id}",
tags: ["CVMate Profile"],
operationId: "updateCvmateProject",
summary: "Update project",
description:
"Updates a project belonging to the authenticated user's CVMate Master Profile. An update cannot leave the project entirely empty. Requires authentication.",
successDescription: "The updated project.",
})
.input(cvmateProfileDto.updateProject.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.updateProject.output)
.handler(({ input, context }) =>
cvmateProfileService.updateProject({
userId: context.user.id,
...input,
}),
),

deleteProject: protectedProcedure
.route({
method: "DELETE",
path: "/cvmate/profile/projects/{id}",
tags: ["CVMate Profile"],
operationId: "deleteCvmateProject",
summary: "Delete project",
description:
"Deletes a project belonging to the authenticated user's CVMate Master Profile. Requires authentication.",
successDescription: "The project was deleted.",
})
.input(cvmateProfileDto.deleteProject.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.deleteProject.output)
.handler(({ input, context }) =>
cvmateProfileService.deleteProject({
id: input.id,
userId: context.user.id,
}),
),

createEducation: protectedProcedure
.route({
method: "POST",
path: "/cvmate/profile/education",
tags: ["CVMate Profile"],
operationId: "createCvmateEducation",
summary: "Create education",
description:
"Adds an education record to the authenticated user's CVMate Master Profile. The record must contain at least one non-empty business field. Requires authentication.",
successDescription: "The created education record.",
})
.input(cvmateProfileDto.createEducation.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.createEducation.output)
.handler(({ input, context }) =>
cvmateProfileService.createEducation({
userId: context.user.id,
...input,
}),
),

updateEducation: protectedProcedure
.route({
method: "PUT",
path: "/cvmate/profile/education/{id}",
tags: ["CVMate Profile"],
operationId: "updateCvmateEducation",
summary: "Update education",
description:
"Updates an education record belonging to the authenticated user's CVMate Master Profile. An update cannot leave the education record entirely empty. Requires authentication.",
successDescription: "The updated education record.",
})
.input(cvmateProfileDto.updateEducation.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.updateEducation.output)
.handler(({ input, context }) =>
cvmateProfileService.updateEducation({
userId: context.user.id,
...input,
}),
),

deleteEducation: protectedProcedure
.route({
method: "DELETE",
path: "/cvmate/profile/education/{id}",
tags: ["CVMate Profile"],
operationId: "deleteCvmateEducation",
summary: "Delete education",
description:
"Deletes an education record belonging to the authenticated user's CVMate Master Profile. Requires authentication.",
successDescription: "The education record was deleted.",
})
.input(cvmateProfileDto.deleteEducation.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.deleteEducation.output)
.handler(({ input, context }) =>
cvmateProfileService.deleteEducation({
id: input.id,
userId: context.user.id,
}),
),

createCourse: protectedProcedure
.route({
method: "POST",
path: "/cvmate/profile/courses",
tags: ["CVMate Profile"],
operationId: "createCvmateCourse",
summary: "Create course",
description:
"Adds a course to the authenticated user's CVMate Master Profile. The record must contain at least one non-empty business field. Requires authentication.",
successDescription: "The created course.",
})
.input(cvmateProfileDto.createCourse.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.createCourse.output)
.handler(({ input, context }) =>
cvmateProfileService.createCourse({
userId: context.user.id,
...input,
}),
),

updateCourse: protectedProcedure
.route({
method: "PUT",
path: "/cvmate/profile/courses/{id}",
tags: ["CVMate Profile"],
operationId: "updateCvmateCourse",
summary: "Update course",
description:
"Updates a course belonging to the authenticated user's CVMate Master Profile. An update cannot leave the course entirely empty. Requires authentication.",
successDescription: "The updated course.",
})
.input(cvmateProfileDto.updateCourse.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.updateCourse.output)
.handler(({ input, context }) =>
cvmateProfileService.updateCourse({
userId: context.user.id,
...input,
}),
),

deleteCourse: protectedProcedure
.route({
method: "DELETE",
path: "/cvmate/profile/courses/{id}",
tags: ["CVMate Profile"],
operationId: "deleteCvmateCourse",
summary: "Delete course",
description:
"Deletes a course belonging to the authenticated user's CVMate Master Profile. Requires authentication.",
successDescription: "The course was deleted.",
})
.input(cvmateProfileDto.deleteCourse.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.deleteCourse.output)
.handler(({ input, context }) =>
cvmateProfileService.deleteCourse({
id: input.id,
userId: context.user.id,
}),
),

createCertification: protectedProcedure
.route({
method: "POST",
path: "/cvmate/profile/certifications",
tags: ["CVMate Profile"],
operationId: "createCvmateCertification",
summary: "Create certification",
description:
"Adds a certification to the authenticated user's CVMate Master Profile. The record must contain at least one non-empty business field. Requires authentication.",
successDescription: "The created certification.",
})
.input(cvmateProfileDto.createCertification.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.createCertification.output)
.handler(({ input, context }) =>
cvmateProfileService.createCertification({
userId: context.user.id,
...input,
}),
),

updateCertification: protectedProcedure
.route({
method: "PUT",
path: "/cvmate/profile/certifications/{id}",
tags: ["CVMate Profile"],
operationId: "updateCvmateCertification",
summary: "Update certification",
description:
"Updates a certification belonging to the authenticated user's CVMate Master Profile. An update cannot leave the certification entirely empty. Requires authentication.",
successDescription: "The updated certification.",
})
.input(cvmateProfileDto.updateCertification.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.updateCertification.output)
.handler(({ input, context }) =>
cvmateProfileService.updateCertification({
userId: context.user.id,
...input,
}),
),

deleteCertification: protectedProcedure
.route({
method: "DELETE",
path: "/cvmate/profile/certifications/{id}",
tags: ["CVMate Profile"],
operationId: "deleteCvmateCertification",
summary: "Delete certification",
description:
"Deletes a certification belonging to the authenticated user's CVMate Master Profile. Requires authentication.",
successDescription: "The certification was deleted.",
})
.input(cvmateProfileDto.deleteCertification.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.deleteCertification.output)
.handler(({ input, context }) =>
cvmateProfileService.deleteCertification({
id: input.id,
userId: context.user.id,
}),
),

createVolunteer: protectedProcedure
.route({
method: "POST",
path: "/cvmate/profile/volunteer",
tags: ["CVMate Profile"],
operationId: "createCvmateVolunteer",
summary: "Create volunteer record",
description:
"Creates a volunteer record in the authenticated user's CVMate Master Profile. Requires authentication.",
successDescription: "The volunteer record was created.",
})
.input(cvmateProfileDto.createVolunteer.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.createVolunteer.output)
.handler(({ input, context }) =>
cvmateProfileService.createVolunteer({
...input,
userId: context.user.id,
}),
),

updateVolunteer: protectedProcedure
.route({
method: "PUT",
path: "/cvmate/profile/volunteer/{id}",
tags: ["CVMate Profile"],
operationId: "updateCvmateVolunteer",
summary: "Update volunteer record",
description:
"Updates a volunteer record belonging to the authenticated user's CVMate Master Profile. Requires authentication.",
successDescription: "The volunteer record was updated.",
})
.input(cvmateProfileDto.updateVolunteer.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.updateVolunteer.output)
.handler(({ input, context }) =>
cvmateProfileService.updateVolunteer({
...input,
userId: context.user.id,
}),
),

deleteVolunteer: protectedProcedure
.route({
method: "DELETE",
path: "/cvmate/profile/volunteer/{id}",
tags: ["CVMate Profile"],
operationId: "deleteCvmateVolunteer",
summary: "Delete volunteer record",
description:
"Deletes a volunteer record belonging to the authenticated user's CVMate Master Profile. Requires authentication.",
successDescription: "The volunteer record was deleted.",
})
.input(cvmateProfileDto.deleteVolunteer.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.deleteVolunteer.output)
.handler(({ input, context }) =>
cvmateProfileService.deleteVolunteer({
id: input.id,
userId: context.user.id,
}),
),

createLanguage: protectedProcedure
.route({
method: "POST",
path: "/cvmate/profile/languages",
tags: ["CVMate Profile"],
operationId: "createCvmateLanguage",
summary: "Create language",
description:
"Creates a language record in the authenticated user's CVMate Master Profile. Requires authentication.",
successDescription: "The language record was created.",
})
.input(cvmateProfileDto.createLanguage.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.createLanguage.output)
.handler(({ input, context }) =>
cvmateProfileService.createLanguage({
...input,
userId: context.user.id,
}),
),

updateLanguage: protectedProcedure
.route({
method: "PUT",
path: "/cvmate/profile/languages/{id}",
tags: ["CVMate Profile"],
operationId: "updateCvmateLanguage",
summary: "Update language",
description:
"Updates a language record belonging to the authenticated user's CVMate Master Profile. Requires authentication.",
successDescription: "The language record was updated.",
})
.input(cvmateProfileDto.updateLanguage.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.updateLanguage.output)
.handler(({ input, context }) =>
cvmateProfileService.updateLanguage({
...input,
userId: context.user.id,
}),
),

deleteLanguage: protectedProcedure
.route({
method: "DELETE",
path: "/cvmate/profile/languages/{id}",
tags: ["CVMate Profile"],
operationId: "deleteCvmateLanguage",
summary: "Delete language",
description:
"Deletes a language record belonging to the authenticated user's CVMate Master Profile. Requires authentication.",
successDescription: "The language record was deleted.",
})
.input(cvmateProfileDto.deleteLanguage.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.deleteLanguage.output)
.handler(({ input, context }) =>
cvmateProfileService.deleteLanguage({
id: input.id,
userId: context.user.id,
}),
),

createAward: protectedProcedure
.route({
method: "POST",
path: "/cvmate/profile/awards",
tags: ["CVMate Profile"],
operationId: "createCvmateAward",
summary: "Create award",
description:
"Creates an award in the authenticated user's CVMate Master Profile. Requires authentication.",
successDescription: "The award was created.",
})
.input(cvmateProfileDto.createAward.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.createAward.output)
.handler(({ input, context }) =>
cvmateProfileService.createAward({
...input,
userId: context.user.id,
}),
),

updateAward: protectedProcedure
.route({
method: "PUT",
path: "/cvmate/profile/awards/{id}",
tags: ["CVMate Profile"],
operationId: "updateCvmateAward",
summary: "Update award",
description:
"Updates an award belonging to the authenticated user's CVMate Master Profile. Requires authentication.",
successDescription: "The award was updated.",
})
.input(cvmateProfileDto.updateAward.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.updateAward.output)
.handler(({ input, context }) =>
cvmateProfileService.updateAward({
...input,
userId: context.user.id,
}),
),

deleteAward: protectedProcedure
.route({
method: "DELETE",
path: "/cvmate/profile/awards/{id}",
tags: ["CVMate Profile"],
operationId: "deleteCvmateAward",
summary: "Delete award",
description:
"Deletes an award belonging to the authenticated user's CVMate Master Profile. Requires authentication.",
successDescription: "The award was deleted.",
})
.input(cvmateProfileDto.deleteAward.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.deleteAward.output)
.handler(({ input, context }) =>
cvmateProfileService.deleteAward({
id: input.id,
userId: context.user.id,
}),
),

createReference: protectedProcedure
.route({
method: "POST",
path: "/cvmate/profile/references",
tags: ["CVMate Profile"],
operationId: "createCvmateReference",
summary: "Create reference",
description:
"Creates a reference in the authenticated user's CVMate Master Profile. Requires authentication.",
successDescription: "The reference was created.",
})
.input(cvmateProfileDto.createReference.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.createReference.output)
.handler(({ input, context }) =>
cvmateProfileService.createReference({
...input,
userId: context.user.id,
}),
),

updateReference: protectedProcedure
.route({
method: "PUT",
path: "/cvmate/profile/references/{id}",
tags: ["CVMate Profile"],
operationId: "updateCvmateReference",
summary: "Update reference",
description:
"Updates a reference belonging to the authenticated user's CVMate Master Profile. Requires authentication.",
successDescription: "The reference was updated.",
})
.input(cvmateProfileDto.updateReference.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.updateReference.output)
.handler(({ input, context }) =>
cvmateProfileService.updateReference({
...input,
userId: context.user.id,
}),
),

deleteReference: protectedProcedure
.route({
method: "DELETE",
path: "/cvmate/profile/references/{id}",
tags: ["CVMate Profile"],
operationId: "deleteCvmateReference",
summary: "Delete reference",
description:
"Deletes a reference belonging to the authenticated user's CVMate Master Profile. Requires authentication.",
successDescription: "The reference was deleted.",
})
.input(cvmateProfileDto.deleteReference.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.deleteReference.output)
.handler(({ input, context }) =>
cvmateProfileService.deleteReference({
id: input.id,
userId: context.user.id,
}),
),

createLicense: protectedProcedure
.route({
method: "POST",
path: "/cvmate/profile/licenses",
tags: ["CVMate Profile"],
operationId: "createCvmateLicense",
summary: "Create license",
description:
"Creates a license in the authenticated user's CVMate Master Profile. Requires authentication.",
successDescription: "The license was created.",
})
.input(cvmateProfileDto.createLicense.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.createLicense.output)
.handler(({ input, context }) =>
cvmateProfileService.createLicense({
...input,
userId: context.user.id,
}),
),

updateLicense: protectedProcedure
.route({
method: "PUT",
path: "/cvmate/profile/licenses/{id}",
tags: ["CVMate Profile"],
operationId: "updateCvmateLicense",
summary: "Update license",
description:
"Updates a license belonging to the authenticated user's CVMate Master Profile. Requires authentication.",
successDescription: "The license was updated.",
})
.input(cvmateProfileDto.updateLicense.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.updateLicense.output)
.handler(({ input, context }) =>
cvmateProfileService.updateLicense({
...input,
userId: context.user.id,
}),
),

deleteLicense: protectedProcedure
.route({
method: "DELETE",
path: "/cvmate/profile/licenses/{id}",
tags: ["CVMate Profile"],
operationId: "deleteCvmateLicense",
summary: "Delete license",
description:
"Deletes a license belonging to the authenticated user's CVMate Master Profile. Requires authentication.",
successDescription: "The license was deleted.",
})
.input(cvmateProfileDto.deleteLicense.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.deleteLicense.output)
.handler(({ input, context }) =>
cvmateProfileService.deleteLicense({
id: input.id,
userId: context.user.id,
}),
),

upsertClause: protectedProcedure
.route({
method: "PUT",
path: "/cvmate/profile/clauses/{scope}/{language}",
tags: ["CVMate Profile"],
operationId: "upsertCvmateClause",
summary: "Save clause",
description:
"Creates or updates the clause identified by scope and language in the authenticated user's CVMate Master Profile. Requires authentication.",
successDescription: "The clause was saved.",
})
.input(cvmateProfileDto.upsertClause.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.upsertClause.output)
.handler(({ input, context }) =>
cvmateProfileService.upsertClause({
...input,
userId: context.user.id,
}),
),

deleteClause: protectedProcedure
.route({
method: "DELETE",
path: "/cvmate/profile/clauses/{scope}/{language}",
tags: ["CVMate Profile"],
operationId: "deleteCvmateClause",
summary: "Delete clause",
description:
"Deletes the clause identified by scope and language from the authenticated user's CVMate Master Profile. Requires authentication.",
successDescription: "The clause was deleted.",
})
.input(cvmateProfileDto.deleteClause.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.deleteClause.output)
.handler(({ input, context }) =>
cvmateProfileService.deleteClause({
scope: input.scope,
language: input.language,
userId: context.user.id,
}),
),

createCustomSection: protectedProcedure
.route({
method: "POST",
path: "/cvmate/profile/custom-sections",
tags: ["CVMate Profile"],
operationId: "createCvmateCustomSection",
summary: "Create custom section",
description:
"Creates a custom section in the authenticated user's CVMate Master Profile. Requires authentication.",
successDescription: "The custom section was created.",
})
.input(cvmateProfileDto.createCustomSection.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.createCustomSection.output)
.handler(({ input, context }) =>
cvmateProfileService.createCustomSection({
...input,
userId: context.user.id,
}),
),

updateCustomSection: protectedProcedure
.route({
method: "PUT",
path: "/cvmate/profile/custom-sections/{id}",
tags: ["CVMate Profile"],
operationId: "updateCvmateCustomSection",
summary: "Update custom section",
description:
"Updates a custom section belonging to the authenticated user's CVMate Master Profile. Standard sections cannot be modified through this endpoint. Requires authentication.",
successDescription: "The custom section was updated.",
})
.input(cvmateProfileDto.updateCustomSection.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.updateCustomSection.output)
.handler(({ input, context }) =>
cvmateProfileService.updateCustomSection({
...input,
userId: context.user.id,
}),
),

deleteCustomSection: protectedProcedure
.route({
method: "DELETE",
path: "/cvmate/profile/custom-sections/{id}",
tags: ["CVMate Profile"],
operationId: "deleteCvmateCustomSection",
summary: "Delete custom section",
description:
"Deletes a custom section belonging to the authenticated user's CVMate Master Profile. Standard sections cannot be deleted through this endpoint. Requires authentication.",
successDescription: "The custom section was deleted.",
})
.input(cvmateProfileDto.deleteCustomSection.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.deleteCustomSection.output)
.handler(({ input, context }) =>
cvmateProfileService.deleteCustomSection({
id: input.id,
userId: context.user.id,
}),
),

createCustomSectionItem: protectedProcedure
.route({
method: "POST",
path: "/cvmate/profile/custom-sections/{profileSectionId}/items",
tags: ["CVMate Profile"],
operationId: "createCvmateCustomSectionItem",
summary: "Create custom section item",
description:
"Creates an item inside a custom section belonging to the authenticated user's CVMate Master Profile. Requires authentication.",
successDescription: "The custom section item was created.",
})
.input(cvmateProfileDto.createCustomSectionItem.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.createCustomSectionItem.output)
.handler(({ input, context }) =>
cvmateProfileService.createCustomSectionItem({
...input,
userId: context.user.id,
}),
),

updateCustomSectionItem: protectedProcedure
.route({
method: "PUT",
path: "/cvmate/profile/custom-section-items/{id}",
tags: ["CVMate Profile"],
operationId: "updateCvmateCustomSectionItem",
summary: "Update custom section item",
description:
"Updates an item belonging to a custom section in the authenticated user's CVMate Master Profile. Requires authentication.",
successDescription: "The custom section item was updated.",
})
.input(cvmateProfileDto.updateCustomSectionItem.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.updateCustomSectionItem.output)
.handler(({ input, context }) =>
cvmateProfileService.updateCustomSectionItem({
...input,
userId: context.user.id,
}),
),

deleteCustomSectionItem: protectedProcedure
.route({
method: "DELETE",
path: "/cvmate/profile/custom-section-items/{id}",
tags: ["CVMate Profile"],
operationId: "deleteCvmateCustomSectionItem",
summary: "Delete custom section item",
description:
"Deletes an item belonging to a custom section in the authenticated user's CVMate Master Profile. Requires authentication.",
successDescription: "The custom section item was deleted.",
})
.input(cvmateProfileDto.deleteCustomSectionItem.input)
.use(resumeMutationRateLimit)
.output(cvmateProfileDto.deleteCustomSectionItem.output)
.handler(({ input, context }) =>
cvmateProfileService.deleteCustomSectionItem({
id: input.id,
userId: context.user.id,
}),
),
};
