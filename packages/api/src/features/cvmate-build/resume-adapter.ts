import { ORPCError } from "@orpc/client";
import type { Locale } from "@reactive-resume/utils/locale";
import { resolveCvLocale } from "@reactive-resume/utils/locale";
import type { z } from "zod";
import type {
	cvmateGeneratedContentSchema,
	cvmateSelectionItemSchema,
} from "../../dto/cvmate-build";
import type { cvmateMasterProfileAggregateSchema } from "../../dto/cvmate-profile";
import {
	cvmateAwardSchema,
	cvmateCertificationSchema,
	cvmateClauseSchema,
	cvmateCourseSchema,
	cvmateCustomSectionItemSchema,
	cvmateEducationSchema,
	cvmateEmploymentSchema,
	cvmateExperienceFactSchema,
	cvmateLanguageSchema,
	cvmateLicenseSchema,
	cvmateProfileListItemSchema,
	cvmateProfilePhotoSchema,
	cvmateProfileSectionSchema,
	cvmateProjectSchema,
	cvmateReferenceSchema,
	cvmateVolunteerSchema,
} from "../../dto/cvmate-profile";
import { createResumeData } from "../resume/initial-data";
import { parseWritableResumeData } from "../resume/resume-data-validation";
import { buildPublicUrl } from "../storage";

type CvmateMasterProfileAggregate = z.infer<
	typeof cvmateMasterProfileAggregateSchema
>;
type CvmateSelectionItem = z.infer<typeof cvmateSelectionItemSchema>;
type CvmateGeneratedContent = z.infer<typeof cvmateGeneratedContentSchema>;

type CvmateResumeAdapterInput = {
	profile: CvmateMasterProfileAggregate;
	selectionItems: CvmateSelectionItem[];
	generatedContent: CvmateGeneratedContent[];
	targetLanguage: string | null;
};

type SummaryGroup = {
	title: string;
	items: Array<{
		id: string;
		hidden: false;
		content: string;
	}>;
};

const projectSnapshotSchema = cvmateProjectSchema.pick({
	name: true,
	startDate: true,
	endDate: true,
	description: true,
});

const educationSnapshotSchema = cvmateEducationSchema.pick({
	institution: true,
	fieldOfStudy: true,
	specialization: true,
	degree: true,
	startDate: true,
	endDate: true,
	description: true,
});

const certificationSnapshotSchema = cvmateCertificationSchema.pick({
	name: true,
	issuingOrganization: true,
	issueDate: true,
	expiryDate: true,
	credentialNumber: true,
	credentialUrl: true,
	description: true,
});

const volunteerSnapshotSchema = cvmateVolunteerSchema.pick({
	organization: true,
	role: true,
	date: true,
	description: true,
});

const languageSnapshotSchema = cvmateLanguageSchema.pick({
	language: true,
	level: true,
});

const awardSnapshotSchema = cvmateAwardSchema.pick({
	name: true,
	organizer: true,
	date: true,
	description: true,
});

const referenceSnapshotSchema = cvmateReferenceSchema.pick({
	name: true,
	issuer: true,
	date: true,
	description: true,
});

const licenseSnapshotSchema = cvmateLicenseSchema.pick({
	name: true,
	date: true,
	description: true,
});

const employmentSnapshotSchema = cvmateEmploymentSchema.pick({
	company: true,
	jobTitle: true,
	location: true,
	startDate: true,
	endDate: true,
	isCurrent: true,
});

const experienceFactSnapshotSchema = cvmateExperienceFactSchema.pick({
	text: true,
});

const profileListItemSnapshotSchema = cvmateProfileListItemSchema.pick({
	kind: true,
	value: true,
});

const courseSnapshotSchema = cvmateCourseSchema.pick({
	name: true,
	organizer: true,
	date: true,
	description: true,
});

const clauseSnapshotSchema = cvmateClauseSchema.pick({
	scope: true,
	language: true,
	isEnabled: true,
	content: true,
});

const customSectionSnapshotSchema = cvmateProfileSectionSchema.pick({
	id: true,
	kind: true,
	title: true,
	isVisible: true,
	sortOrder: true,
});

const customSectionItemSnapshotSchema = cvmateCustomSectionItemSchema
	.pick({
		title: true,
		subtitle: true,
		date: true,
		description: true,
		url: true,
		fields: true,
	})
	.extend({
		section: customSectionSnapshotSchema,
	});

const profilePhotoSnapshotSchema = cvmateProfilePhotoSchema.pick({
	storageKey: true,
});

function resolveResumeLocale(targetLanguage: string | null): Locale {
	return resolveCvLocale(targetLanguage);
}

function joinName(firstName: string | null, lastName: string | null): string {
	return [firstName, lastName]
		.map((value) => value?.trim())
		.filter((value): value is string => Boolean(value))
		.join(" ");
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

function paragraphHtml(value: string | null): string {
	return value ? `<p>${escapeHtml(value)}</p>` : "";
}

function paragraphsHtml(values: Array<string | null>): string {
	return values
		.filter((value): value is string => Boolean(value))
		.map((value) => paragraphHtml(value))
		.join("");
}

function listHtml(values: string[]): string {
	if (values.length === 0) return "";
	return `<ul>${values.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>`;
}

function formatPeriod(
	startDate: string | null,
	endDate: string | null,
): string {
	if (startDate && endDate) return `${startDate} - ${endDate}`;
	return startDate ?? endDate ?? "";
}

function formatEmploymentPeriod(
	startDate: string | null,
	endDate: string | null,
	isCurrent: boolean,
	locale: Locale,
): string {
	if (!isCurrent) return formatPeriod(startDate, endDate);

	const present = locale.toLowerCase().startsWith("pl") ? "Obecnie" : "Present";
	return startDate ? `${startDate} - ${present}` : present;
}

function joinNonEmpty(values: Array<string | null>, separator: string): string {
	return values
		.filter((value): value is string => Boolean(value))
		.join(separator);
}

function itemWebsite(url = "") {
	return {
		url,
		label: url,
		inlineLink: false,
	};
}

function requireSnapshotValue(value: string | null, message: string): string {
	if (value) return value;
	throw new ORPCError("BAD_REQUEST", { message });
}

function addSummaryItem(
	groups: Map<string, SummaryGroup>,
	groupId: string,
	title: string,
	item: SummaryGroup["items"][number],
) {
	const existing = groups.get(groupId);

	if (existing) {
		existing.items.push(item);
		return;
	}

	groups.set(groupId, { title, items: [item] });
}

function latestGeneratedContent(
	items: CvmateGeneratedContent[],
	kind: CvmateGeneratedContent["kind"],
	selectionItemId: string | null,
): CvmateGeneratedContent | undefined {
	let latest: CvmateGeneratedContent | undefined;

	for (const item of items) {
		if (item.kind !== kind || item.selectionItemId !== selectionItemId)
			continue;

		if (
			!latest ||
			item.createdAt.getTime() > latest.createdAt.getTime() ||
			(item.createdAt.getTime() === latest.createdAt.getTime() &&
				item.id > latest.id)
		) {
			latest = item;
		}
	}

	return latest;
}

function resolveGeneratedText(
	generated: CvmateGeneratedContent | undefined,
	fallback: string | null,
): string | null {
	if (!generated) return fallback;
	return (
		generated.finalText ?? generated.aiText ?? generated.sourceText ?? fallback
	);
}

export function createResumeDataFromCvmate(input: CvmateResumeAdapterInput) {
	const locale = resolveResumeLocale(input.targetLanguage);
	const data = createResumeData({ locale });

	const profile = input.profile.profile;
	const selectedItems = input.selectionItems.filter(
		(selection) => selection.selected,
	);
	const selectedById = new Map(
		selectedItems.map((selection) => [selection.id, selection]),
	);
	const summaryGroups = new Map<string, SummaryGroup>();
	const selectedPhotos = selectedItems.filter(
		(selection) => selection.sourceType === "profile_photo",
	);

	if (selectedPhotos.length > 1) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Only one profile photo can be selected for a CV.",
		});
	}

	data.basics.name = joinName(profile.firstName, profile.lastName);
	data.basics.headline = "";
	data.basics.email = profile.email ?? "";
	data.basics.phone = profile.phone ?? "";
	data.basics.location = profile.location ?? "";

	if (profile.websiteUrl) {
		data.basics.website = {
			url: profile.websiteUrl,
			label: profile.websiteUrl,
		};
	}

	if (profile.linkedinUrl) {
		data.sections.profiles.items.push({
			id: "cvmate-linkedin",
			hidden: false,
			icon: "",
			iconColor: "",
			network: "LinkedIn",
			username: "",
			website: itemWebsite(profile.linkedinUrl),
		});
	}

	const professionalSummary = latestGeneratedContent(
		input.generatedContent,
		"professional_summary",
		null,
	);
	const professionalSummaryText = resolveGeneratedText(
		professionalSummary,
		null,
	);
	data.summary.content = paragraphHtml(professionalSummaryText);

	const selectedPhoto = selectedPhotos[0];

	if (selectedPhoto) {
		const snapshot = profilePhotoSnapshotSchema.parse(
			selectedPhoto.sourceDataSnapshot,
		);
		data.picture.hidden = false;
		data.picture.url = buildPublicUrl(snapshot.storageKey);
	}

	for (const selection of selectedItems) {
		if (selection.sourceType !== "experience_fact") continue;

		const parent = selection.parentSelectionItemId
			? selectedById.get(selection.parentSelectionItemId)
			: undefined;

		if (parent?.sourceType !== "employment") {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"A selected experience fact must belong to a selected employment.",
			});
		}
	}

	for (const selection of selectedItems) {
		switch (selection.sourceType) {
			case "employment": {
				const snapshot = employmentSnapshotSchema.parse(
					selection.sourceDataSnapshot,
				);
				const company = requireSnapshotValue(
					snapshot.company,
					"A selected employment must have a company before the CV can be created.",
				);

				const facts = selectedItems
					.filter(
						(item) =>
							item.sourceType === "experience_fact" &&
							item.parentSelectionItemId === selection.id,
					)
					.map((item) => {
						const snapshot = experienceFactSnapshotSchema.parse(
							item.sourceDataSnapshot,
						);
						const generated = latestGeneratedContent(
							input.generatedContent,
							"experience_fact",
							item.id,
						);

						return (
							resolveGeneratedText(generated, snapshot.text) ?? snapshot.text
						);
					});

				data.sections.experience.items.push({
					id: selection.id,
					hidden: false,
					company,
					position: snapshot.jobTitle ?? "",
					location: snapshot.location ?? "",
					period: formatEmploymentPeriod(
						snapshot.startDate,
						snapshot.endDate,
						snapshot.isCurrent,
						locale,
					),
					website: itemWebsite(),
					description: listHtml(facts),
					roles: [],
				});
				break;
			}

			case "experience_fact":
			case "profile_photo":
				break;

			case "project": {
				const snapshot = projectSnapshotSchema.parse(
					selection.sourceDataSnapshot,
				);
				const name = requireSnapshotValue(
					snapshot.name,
					"A selected project must have a name before the CV can be created.",
				);

				data.sections.projects.items.push({
					id: selection.id,
					hidden: false,
					name,
					period: formatPeriod(snapshot.startDate, snapshot.endDate),
					website: itemWebsite(),
					description: paragraphHtml(snapshot.description),
				});
				break;
			}

			case "education": {
				const snapshot = educationSnapshotSchema.parse(
					selection.sourceDataSnapshot,
				);
				const school = requireSnapshotValue(
					snapshot.institution,
					"A selected education record must have an institution before the CV can be created.",
				);

				data.sections.education.items.push({
					id: selection.id,
					hidden: false,
					school,
					degree: snapshot.degree ?? "",
					area: joinNonEmpty(
						[snapshot.fieldOfStudy, snapshot.specialization],
						" - ",
					),
					grade: "",
					location: "",
					period: formatPeriod(snapshot.startDate, snapshot.endDate),
					website: itemWebsite(),
					description: paragraphHtml(snapshot.description),
				});
				break;
			}

			case "certification": {
				const snapshot = certificationSnapshotSchema.parse(
					selection.sourceDataSnapshot,
				);
				const title = requireSnapshotValue(
					snapshot.name,
					"A selected certification must have a name before the CV can be created.",
				);

				data.sections.certifications.items.push({
					id: selection.id,
					hidden: false,
					title,
					issuer: snapshot.issuingOrganization ?? "",
					date: snapshot.issueDate ?? "",
					website: itemWebsite(snapshot.credentialUrl ?? ""),
					description: paragraphHtml(snapshot.description),
				});
				break;
			}

			case "volunteer": {
				const snapshot = volunteerSnapshotSchema.parse(
					selection.sourceDataSnapshot,
				);
				const organization = requireSnapshotValue(
					snapshot.organization,
					"A selected volunteer record must have an organization before the CV can be created.",
				);

				data.sections.volunteer.items.push({
					id: selection.id,
					hidden: false,
					organization,
					location: "",
					period: snapshot.date ?? "",
					website: itemWebsite(),
					description: paragraphsHtml([snapshot.role, snapshot.description]),
				});
				break;
			}

			case "language": {
				const snapshot = languageSnapshotSchema.parse(
					selection.sourceDataSnapshot,
				);
				const language = requireSnapshotValue(
					snapshot.language,
					"A selected language record must have a language before the CV can be created.",
				);

				data.sections.languages.items.push({
					id: selection.id,
					hidden: false,
					language,
					fluency: snapshot.level ?? "",
					level: 0,
				});
				break;
			}

			case "award": {
				const snapshot = awardSnapshotSchema.parse(
					selection.sourceDataSnapshot,
				);
				const title = requireSnapshotValue(
					snapshot.name,
					"A selected award must have a name before the CV can be created.",
				);

				data.sections.awards.items.push({
					id: selection.id,
					hidden: false,
					title,
					awarder: snapshot.organizer ?? "",
					date: snapshot.date ?? "",
					website: itemWebsite(),
					description: paragraphHtml(snapshot.description),
				});
				break;
			}

			case "reference": {
				const snapshot = referenceSnapshotSchema.parse(
					selection.sourceDataSnapshot,
				);
				const name = requireSnapshotValue(
					snapshot.name,
					"A selected reference must have a name before the CV can be created.",
				);

				data.sections.references.items.push({
					id: selection.id,
					hidden: false,
					name,
					position: snapshot.issuer ?? "",
					website: itemWebsite(),
					phone: "",
					description: paragraphHtml(snapshot.description),
				});
				break;
			}

			case "license": {
				const snapshot = licenseSnapshotSchema.parse(
					selection.sourceDataSnapshot,
				);
				const title = requireSnapshotValue(
					snapshot.name,
					"A selected license must have a name before the CV can be created.",
				);

				data.sections.certifications.items.push({
					id: selection.id,
					hidden: false,
					title,
					issuer: "",
					date: snapshot.date ?? "",
					website: itemWebsite(),
					description: paragraphHtml(snapshot.description),
				});
				break;
			}

			case "profile_list_item": {
				const snapshot = profileListItemSnapshotSchema.parse(
					selection.sourceDataSnapshot,
				);

				if (snapshot.kind === "interest") {
					data.sections.interests.items.push({
						id: selection.id,
						hidden: false,
						icon: "",
						iconColor: "",
						name: snapshot.value,
						keywords: [],
					});
				} else {
					data.sections.skills.items.push({
						id: selection.id,
						hidden: false,
						icon: "",
						iconColor: "",
						name: snapshot.value,
						proficiency: "",
						level: 0,
						keywords: [],
					});
				}
				break;
			}

			case "course": {
				const snapshot = courseSnapshotSchema.parse(
					selection.sourceDataSnapshot,
				);
				const content = paragraphsHtml([
					snapshot.name,
					snapshot.organizer,
					snapshot.date,
					snapshot.description,
				]);

				if (!content) {
					throw new ORPCError("BAD_REQUEST", {
						message:
							"A selected course must contain content before the CV can be created.",
					});
				}

				addSummaryItem(summaryGroups, "cvmate-courses", "Courses", {
					id: selection.id,
					hidden: false,
					content,
				});
				break;
			}

			case "clause": {
				const snapshot = clauseSnapshotSchema.parse(
					selection.sourceDataSnapshot,
				);

				if (!snapshot.isEnabled) {
					throw new ORPCError("BAD_REQUEST", {
						message: "A disabled clause cannot be selected for the CV.",
					});
				}

				const content = requireSnapshotValue(
					snapshot.content,
					"A selected clause must have content before the CV can be created.",
				);

				addSummaryItem(summaryGroups, "cvmate-clauses", "Clauses", {
					id: selection.id,
					hidden: false,
					content: paragraphHtml(content),
				});
				break;
			}

			case "custom_section_item": {
				const snapshot = customSectionItemSnapshotSchema.parse(
					selection.sourceDataSnapshot,
				);

				if (snapshot.section.kind !== "custom") {
					throw new ORPCError("BAD_REQUEST", {
						message:
							"A selected custom section item must belong to a custom section.",
					});
				}

				const content = paragraphsHtml([
					snapshot.title,
					snapshot.subtitle,
					snapshot.date,
					snapshot.description,
					snapshot.url,
				]);

				if (!content) {
					throw new ORPCError("BAD_REQUEST", {
						message:
							"A selected custom section item must contain renderable content.",
					});
				}

				addSummaryItem(
					summaryGroups,
					`cvmate-custom-${snapshot.section.id}`,
					snapshot.section.title,
					{
						id: selection.id,
						hidden: false,
						content,
					},
				);
				break;
			}
		}
	}

	const firstPage = data.metadata.layout.pages[0];

	if (!firstPage) {
		throw new ORPCError("BAD_REQUEST", {
			message: "The resume layout must contain at least one page.",
		});
	}

	for (const [id, group] of summaryGroups) {
		data.customSections.push({
			id,
			type: "summary",
			title: group.title,
			icon: "",
			columns: 1,
			hidden: false,
			showHeading: true,
			keepTogether: false,
			startOnNewPage: false,
			items: group.items,
		});

		firstPage.main.push(id);
	}

	return parseWritableResumeData(data);
}
