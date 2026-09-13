import { ORPCError } from "@orpc/server";
import z from "zod";
import { protectedProcedure } from "../../context";
import { storageDeleteRateLimit, storageUploadRateLimit } from "../../middleware/rate-limit";
import {
	getStorageService,
	hasPdfSignature,
	isAllowedPublicUpload,
	isImageFile,
	MAX_UPLOAD_BYTES,
	normalizeStorageKey,
	processImageForUpload,
	uploadFile,
} from "./service";

const storageService = getStorageService();

const fileSchema = z
	.file()
	.max(MAX_UPLOAD_BYTES, "File size must be less than 10MB")
	.refine((file) => isAllowedPublicUpload(file.type), "Files must be PDF, JPEG, PNG, WebP, or GIF.");

const filenameSchema = z.object({
	filename: z.string().trim().min(1).max(512).describe("The path or filename of the file to delete."),
});

export const storageRouter = {
	uploadFile: protectedProcedure
		.route({
			tags: ["Internal"],
			operationId: "uploadFile",
			summary: "Upload a file",
			description:
				"Uploads a PDF, JPEG, PNG, WebP, or GIF file to storage. Images are validated, resized, and converted to JPEG format. Maximum file size is 10MB. Requires authentication.",
			successDescription: "The file was uploaded successfully.",
		})
		.input(fileSchema)
		.use(storageUploadRateLimit)
		.output(
			z.object({
				url: z.string().describe("The public URL to access the uploaded file."),
				path: z.string().describe("The storage path of the uploaded file."),
				contentType: z.string().describe("The MIME type of the uploaded file."),
			}),
		)
		.handler(async ({ context, input: file }) => {
			const originalMimeType = file.type;
			const isImage = isImageFile(originalMimeType);

			let data: Uint8Array;
			let contentType: string;

			if (isImage) {
				try {
					const processed = await processImageForUpload(file);
					data = processed.data;
					contentType = processed.contentType;
				} catch {
					throw new ORPCError("BAD_REQUEST", {
						message: "The uploaded image is invalid, corrupted, or does not match its declared type.",
					});
				}
			} else {
				const fileBuffer = await file.arrayBuffer();
				data = new Uint8Array(fileBuffer);
				contentType = originalMimeType;

				if (contentType !== "application/pdf" || !hasPdfSignature(data)) {
					throw new ORPCError("BAD_REQUEST", {
						message: "The uploaded PDF is invalid or corrupted.",
					});
				}
			}

			const result = await uploadFile({ userId: context.user.id, data, contentType });

			return {
				url: result.url,
				path: result.key,
				contentType,
			};
		}),

	deleteFile: protectedProcedure
		.route({
			tags: ["Internal"],
			operationId: "deleteFile",
			summary: "Delete a file",
			description:
				"Deletes a file from storage by its filename or path. If the filename does not start with 'uploads/', the user's picture directory is assumed. Requires authentication.",
			successDescription: "The file was deleted successfully.",
		})
		.input(filenameSchema)
		.use(storageDeleteRateLimit)
		.output(z.void())
		.errors({
			NOT_FOUND: {
				message: "The specified file was not found in storage.",
				status: 404,
			},
			FORBIDDEN: {
				message: "You do not have permission to delete this file.",
				status: 403,
			},
		})
		.handler(async ({ context, input }): Promise<void> => {
			let requestedKey: string;

			try {
				requestedKey = normalizeStorageKey(input.filename);
			} catch {
				throw new ORPCError("FORBIDDEN");
			}

			const userPrefix = `uploads/${context.user.id}/`;
			let key: string;

			try {
				key = requestedKey.startsWith("uploads/")
					? requestedKey
					: normalizeStorageKey(`${userPrefix}pictures/${requestedKey}`);
			} catch {
				throw new ORPCError("FORBIDDEN");
			}

			if (!key.startsWith(userPrefix)) {
				throw new ORPCError("FORBIDDEN");
			}

			const deleted = await storageService.delete(key);

			if (!deleted) throw new ORPCError("NOT_FOUND");
		}),
};
