import type { CvmateBuildIdentitySnapshot } from "@reactive-resume/db/schema";
import type { AiRedactionContext } from "../ai/redaction";
import { eq } from "drizzle-orm";
import { db } from "@reactive-resume/db/client";
import * as schema from "@reactive-resume/db/schema";
import { buildAiRedactionContext } from "../ai/redaction";

/**
 * Redaction context for a CV build's AI payloads: the union of the identity frozen in the build and
 * the user's current Master Profile identity, so details changed after the build was created are
 * still kept out of the prompt.
 */
export async function resolveCvBuildAiRedactionContext(input: {
	userId: string;
	identitySnapshot: CvmateBuildIdentitySnapshot | null | undefined;
}): Promise<AiRedactionContext> {
	const [currentProfile] = await db
		.select({
			firstName: schema.cvmateMasterProfile.firstName,
			lastName: schema.cvmateMasterProfile.lastName,
			email: schema.cvmateMasterProfile.email,
			phone: schema.cvmateMasterProfile.phone,
			linkedinUrl: schema.cvmateMasterProfile.linkedinUrl,
			websiteUrl: schema.cvmateMasterProfile.websiteUrl,
		})
		.from(schema.cvmateMasterProfile)
		.where(eq(schema.cvmateMasterProfile.userId, input.userId));

	return buildAiRedactionContext([input.identitySnapshot, currentProfile]);
}
