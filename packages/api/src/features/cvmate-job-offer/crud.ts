import { protectedProcedure } from "../../context";
import { cvmateJobOfferDto } from "../../dto/cvmate-job-offer";
import { resumeMutationRateLimit, storageUploadRateLimit } from "../../middleware/rate-limit";
import { cvmateJobOfferService } from "./service";

export const crudRouter = {
	list: protectedProcedure
		.route({
			method: "GET",
			path: "/cvmate/job-offers",
			tags: ["1story Job Offers"],
			operationId: "listCvmateJobOffers",
			summary: "List 1story job offers",
			description:
				"Returns all job offers belonging to the authenticated user, most recently updated first. Requires authentication.",
			successDescription: "A list of the user's 1story job offers.",
		})
		.input(cvmateJobOfferDto.list.input)
		.output(cvmateJobOfferDto.list.output)
		.handler(({ context }) =>
			cvmateJobOfferService.list({
				userId: context.user.id,
			}),
		),

	getById: protectedProcedure
		.route({
			method: "GET",
			path: "/cvmate/job-offers/{id}",
			tags: ["1story Job Offers"],
			operationId: "getCvmateJobOffer",
			summary: "Get 1story job offer",
			description:
				"Returns a job offer together with its uploaded assets and extracted or manually edited requirements. Only offers belonging to the authenticated user can be retrieved. Requires authentication.",
			successDescription: "The 1story job offer.",
		})
		.input(cvmateJobOfferDto.getById.input)
		.output(cvmateJobOfferDto.getById.output)
		.handler(({ input, context }) =>
			cvmateJobOfferService.getById({
				id: input.id,
				userId: context.user.id,
			}),
		),

	create: protectedProcedure
		.route({
			method: "POST",
			path: "/cvmate/job-offers",
			tags: ["1story Job Offers"],
			operationId: "createCvmateJobOffer",
			summary: "Create 1story job offer",
			description:
				"Creates a job-offer record for pasted text, a source URL, manually entered metadata, or assets uploaded in a subsequent request. Analysis is not performed by this endpoint. Requires authentication.",
			successDescription: "The ID of the newly created 1story job offer.",
		})
		.input(cvmateJobOfferDto.create.input)
		.use(resumeMutationRateLimit)
		.output(cvmateJobOfferDto.create.output)
		.handler(({ input, context }) =>
			cvmateJobOfferService.create({
				userId: context.user.id,
				...input,
			}),
		),

	update: protectedProcedure
		.route({
			method: "PUT",
			path: "/cvmate/job-offers/{id}",
			tags: ["1story Job Offers"],
			operationId: "updateCvmateJobOffer",
			summary: "Update 1story job offer",
			description:
				"Updates editable job-offer source or metadata fields. Changing source text or source URL resets analysis status to pending. AI-owned analysis fields cannot be edited through this endpoint. Requires authentication.",
			successDescription: "The updated 1story job offer.",
		})
		.input(cvmateJobOfferDto.update.input)
		.use(resumeMutationRateLimit)
		.output(cvmateJobOfferDto.update.output)
		.handler(({ input, context }) =>
			cvmateJobOfferService.update({
				...input,
				userId: context.user.id,
			}),
		),

	delete: protectedProcedure
		.route({
			method: "DELETE",
			path: "/cvmate/job-offers/{id}",
			tags: ["1story Job Offers"],
			operationId: "deleteCvmateJobOffer",
			summary: "Delete 1story job offer",
			description:
				"Permanently deletes a job offer and its related requirements and assets. Stored asset files are cleaned up after the database record is deleted. Requires authentication.",
			successDescription: "The 1story job offer was deleted successfully.",
		})
		.input(cvmateJobOfferDto.delete.input)
		.use(resumeMutationRateLimit)
		.output(cvmateJobOfferDto.delete.output)
		.handler(({ input, context }) =>
			cvmateJobOfferService.delete({
				id: input.id,
				userId: context.user.id,
			}),
		),

	uploadAsset: protectedProcedure
		.route({
			method: "POST",
			path: "/cvmate/job-offers/{jobOfferId}/assets",
			tags: ["1story Job Offers"],
			operationId: "uploadCvmateJobOfferAsset",
			summary: "Upload 1story job-offer asset",
			description:
				"Uploads a PDF or image containing job-offer content. Images are preserved at their original resolution for later text extraction. Maximum file size is 10MB. Requires authentication.",
			successDescription: "The uploaded job-offer asset.",
			spec: (current) => {
				const requestBody = current.requestBody;
				if (!requestBody || "$ref" in requestBody) return current;

				const multipart = requestBody.content?.["multipart/form-data"];
				if (!multipart) return current;

				return {
					...current,
					requestBody: {
						...requestBody,
						content: { "multipart/form-data": multipart },
					},
				};
			},
		})
		.input(cvmateJobOfferDto.uploadAsset.input)
		.use(storageUploadRateLimit)
		.output(cvmateJobOfferDto.uploadAsset.output)
		.handler(({ input, context }) =>
			cvmateJobOfferService.uploadAsset({
				jobOfferId: input.jobOfferId,
				userId: context.user.id,
				file: input.file,
				...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
			}),
		),

	updateAsset: protectedProcedure
		.route({
			method: "PUT",
			path: "/cvmate/job-offer-assets/{id}",
			tags: ["1story Job Offers"],
			operationId: "updateCvmateJobOfferAsset",
			summary: "Update 1story job-offer asset",
			description:
				"Updates the display order of an uploaded job-offer asset belonging to the authenticated user. Requires authentication.",
			successDescription: "The updated job-offer asset.",
		})
		.input(cvmateJobOfferDto.updateAsset.input)
		.use(resumeMutationRateLimit)
		.output(cvmateJobOfferDto.updateAsset.output)
		.handler(({ input, context }) =>
			cvmateJobOfferService.updateAsset({
				...input,
				userId: context.user.id,
			}),
		),

	deleteAsset: protectedProcedure
		.route({
			method: "DELETE",
			path: "/cvmate/job-offer-assets/{id}",
			tags: ["1story Job Offers"],
			operationId: "deleteCvmateJobOfferAsset",
			summary: "Delete 1story job-offer asset",
			description:
				"Deletes an uploaded job-offer asset and resets the parent offer analysis status to pending. Requires authentication.",
			successDescription: "The job-offer asset was deleted successfully.",
		})
		.input(cvmateJobOfferDto.deleteAsset.input)
		.use(resumeMutationRateLimit)
		.output(cvmateJobOfferDto.deleteAsset.output)
		.handler(({ input, context }) =>
			cvmateJobOfferService.deleteAsset({
				id: input.id,
				userId: context.user.id,
			}),
		),

	createRequirement: protectedProcedure
		.route({
			method: "POST",
			path: "/cvmate/job-offers/{jobOfferId}/requirements",
			tags: ["1story Job Offers"],
			operationId: "createCvmateJobRequirement",
			summary: "Create 1story job requirement",
			description:
				"Creates a manually entered requirement for a job offer. Manually created requirements are marked as user edited. AI extraction is handled separately. Requires authentication.",
			successDescription: "The created job requirement.",
		})
		.input(cvmateJobOfferDto.createRequirement.input)
		.use(resumeMutationRateLimit)
		.output(cvmateJobOfferDto.createRequirement.output)
		.handler(({ input, context }) =>
			cvmateJobOfferService.createRequirement({
				...input,
				userId: context.user.id,
			}),
		),

	updateRequirement: protectedProcedure
		.route({
			method: "PUT",
			path: "/cvmate/job-requirements/{id}",
			tags: ["1story Job Offers"],
			operationId: "updateCvmateJobRequirement",
			summary: "Update 1story job requirement",
			description:
				"Updates a requirement belonging to one of the authenticated user's job offers. The requirement is marked as user edited. Requires authentication.",
			successDescription: "The updated job requirement.",
		})
		.input(cvmateJobOfferDto.updateRequirement.input)
		.use(resumeMutationRateLimit)
		.output(cvmateJobOfferDto.updateRequirement.output)
		.handler(({ input, context }) =>
			cvmateJobOfferService.updateRequirement({
				...input,
				userId: context.user.id,
			}),
		),

	deleteRequirement: protectedProcedure
		.route({
			method: "DELETE",
			path: "/cvmate/job-requirements/{id}",
			tags: ["1story Job Offers"],
			operationId: "deleteCvmateJobRequirement",
			summary: "Delete 1story job requirement",
			description:
				"Deletes a requirement belonging to one of the authenticated user's job offers. Requires authentication.",
			successDescription: "The job requirement was deleted successfully.",
		})
		.input(cvmateJobOfferDto.deleteRequirement.input)
		.use(resumeMutationRateLimit)
		.output(cvmateJobOfferDto.deleteRequirement.output)
		.handler(({ input, context }) =>
			cvmateJobOfferService.deleteRequirement({
				id: input.id,
				userId: context.user.id,
			}),
		),
};
