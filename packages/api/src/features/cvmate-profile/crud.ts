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
.handler(({ context }) => cvmateProfileService.getCurrent({ userId: context.user.id })),

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
};
