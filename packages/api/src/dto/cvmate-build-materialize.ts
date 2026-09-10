import z from "zod";

export const cvmateBuildMaterializeDto = {
	materialize: {
		input: z.object({
			id: z.string().trim().min(1),
		}),
		output: z.object({
			documentId: z.string(),
			resumeId: z.string(),
			created: z.boolean(),
		}),
	},
};
