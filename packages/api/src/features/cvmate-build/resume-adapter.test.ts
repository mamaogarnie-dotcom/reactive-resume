import { describe, expect, it } from "vitest";
import { createResumeDataFromCvmate } from "./resume-adapter";

const now = new Date("2026-09-10T12:00:00.000Z");

const masterProfile = {
	profile: {
		id: "profile-1",
		firstName: "Aga",
		lastName: "Nowak",
		email: "aga@example.com",
		phone: "+48 500 600 700",
		location: "Wroc\u0142aw",
		linkedinUrl: null,
		websiteUrl: "https://example.com",
		createdAt: now,
		updatedAt: now,
	},
	sections: [],
	employments: [],
	experienceFacts: [],
	employmentFacts: [],
	listItems: [],
	projects: [],
	education: [],
	courses: [],
	certifications: [],
	volunteer: [],
	languages: [],
	awards: [],
	references: [],
	licenses: [],
	clauses: [],
	customSectionItems: [],
	photos: [],
};

describe("createResumeDataFromCvmate", () => {
	it("creates canonical resume data with basics and normalizes Polish target language", () => {
		const result = createResumeDataFromCvmate({
			profile: masterProfile,
			selectionItems: [],
			generatedContent: [],
			targetLanguage: "pl",
		});

		expect(result.basics).toMatchObject({
			name: "Aga Nowak",
			headline: "",
			email: "aga@example.com",
			phone: "+48 500 600 700",
			location: "Wroc\u0142aw",
			website: {
				url: "https://example.com",
				label: "https://example.com",
			},
		});
		expect(result.metadata.page.locale).toBe("pl-PL");
		expect(result.metadata.stylesheet).toEqual({
			mode: "semantic",
			source: {
				languageVersion: 1,
				text: "@version 1;\n",
			},
		});
	});

	it("applies CVMate template and color settings to canonical resume metadata", () => {
		const result = createResumeDataFromCvmate({
			profile: masterProfile,
			selectionItems: [],
			generatedContent: [],
			targetLanguage: "pl",
			designSettings: {
				template: "pikachu",
				primaryColor: "#734A75",
				textColor: "#1F2937",
				backgroundColor: "#FFFFFF",
			},
		});

		expect(result.metadata.template).toBe("pikachu");
		expect(result.metadata.design.colors).toEqual({
			primary: "rgba(115, 74, 117, 1)",
			text: "rgba(31, 41, 55, 1)",
			background: "rgba(255, 255, 255, 1)",
		});
	});
	it("passes through canonical locales and falls back to the default locale", () => {
		expect(
			createResumeDataFromCvmate({
				profile: masterProfile,
				selectionItems: [],
				generatedContent: [],
				targetLanguage: "de-DE",
			}).metadata.page.locale,
		).toBe("en-US");

		expect(
			createResumeDataFromCvmate({
				profile: masterProfile,
				selectionItems: [],
				generatedContent: [],
				targetLanguage: null,
			}).metadata.page.locale,
		).toBe("en-US");

		expect(
			createResumeDataFromCvmate({
				profile: masterProfile,
				selectionItems: [],
				generatedContent: [],
				targetLanguage: "unsupported",
			}).metadata.page.locale,
		).toBe("en-US");
	});

	it("maps a selected frozen project snapshot into the projects section", () => {
		const result = createResumeDataFromCvmate({
			profile: masterProfile,
			selectionItems: [
				{
					id: "selection-project-1",
					cvBuildId: "build-1",
					parentSelectionItemId: null,
					sourceType: "project",
					sourceId: "project-1",
					sourceTextSnapshot: "1story",
					sourceDataSnapshot: {
						id: "project-1",
						masterProfileId: "profile-1",
						name: "1story",
						company: "Bioarbor",
						startDate: "2026",
						endDate: "2026",
						description: "Commercial CV builder",
						sortOrder: 0,
						createdAt: "2026-09-01T10:00:00.000Z",
						updatedAt: "2026-09-01T10:00:00.000Z",
					},
					recommended: true,
					selected: true,
					recommendationReason: "Relevant project",
					sortOrder: 0,
					createdAt: now,
					updatedAt: now,
				},
			],
			generatedContent: [],
			targetLanguage: "en-US",
		});

		expect(result.sections.projects.items).toEqual([
			{
				id: "selection-project-1",
				hidden: false,
				name: "1story",
				period: "2026 - 2026",
				website: {
					url: "",
					label: "",
					inlineLink: false,
				},
				description: "<p>Commercial CV builder</p>",
			},
		]);
	});

	it("rejects a selected project snapshot without a name", () => {
		let error: unknown;

		try {
			createResumeDataFromCvmate({
				profile: masterProfile,
				selectionItems: [
					{
						id: "selection-project-without-name",
						cvBuildId: "build-1",
						parentSelectionItemId: null,
						sourceType: "project",
						sourceId: "project-without-name",
						sourceTextSnapshot: null,
						sourceDataSnapshot: {
							name: null,
							company: null,
							startDate: null,
							endDate: null,
							description: null,
						},
						recommended: false,
						selected: true,
						recommendationReason: null,
						sortOrder: 0,
						createdAt: now,
						updatedAt: now,
					},
				],
				generatedContent: [],
				targetLanguage: "en-US",
			});
		} catch (caught) {
			error = caught;
		}

		expect(error).toMatchObject({
			code: "BAD_REQUEST",
			message: "A selected project must have a name before the CV can be created.",
		});
	});

	it("maps selected frozen standard profile snapshots into resume sections", () => {
		const selectionBase = {
			cvBuildId: "build-1",
			parentSelectionItemId: null,
			recommended: true,
			selected: true,
			recommendationReason: "Relevant",
			sortOrder: 0,
			createdAt: now,
			updatedAt: now,
		};

		const result = createResumeDataFromCvmate({
			profile: masterProfile,
			selectionItems: [
				{
					...selectionBase,
					id: "selection-education-1",
					sourceType: "education",
					sourceId: "education-1",
					sourceTextSnapshot: "University of Wroclaw",
					sourceDataSnapshot: {
						institution: "University of Wroclaw",
						fieldOfStudy: "Biology",
						specialization: "Ecology",
						degree: "MSc",
						startDate: "2005",
						endDate: "2010",
						description: "Environmental biology",
					},
				},
				{
					...selectionBase,
					id: "selection-certification-1",
					sourceType: "certification",
					sourceId: "certification-1",
					sourceTextSnapshot: "Project Management",
					sourceDataSnapshot: {
						name: "Project Management",
						issuingOrganization: "PM Academy",
						issueDate: "2025-06",
						expiryDate: null,
						credentialNumber: null,
						credentialUrl: "https://example.com/cert",
						description: "Advanced course",
					},
				},
				{
					...selectionBase,
					id: "selection-volunteer-1",
					sourceType: "volunteer",
					sourceId: "volunteer-1",
					sourceTextSnapshot: "Green Foundation",
					sourceDataSnapshot: {
						organization: "Green Foundation",
						role: "Coordinator",
						date: "2024",
						description: "Organized environmental projects",
					},
				},
				{
					...selectionBase,
					id: "selection-language-1",
					sourceType: "language",
					sourceId: "language-1",
					sourceTextSnapshot: "English",
					sourceDataSnapshot: {
						language: "English",
						level: "B2",
					},
				},
				{
					...selectionBase,
					id: "selection-award-1",
					sourceType: "award",
					sourceId: "award-1",
					sourceTextSnapshot: "Best Project",
					sourceDataSnapshot: {
						name: "Best Project",
						organizer: "Industry Association",
						date: "2025",
						description: "Awarded for 1story",
					},
				},
				{
					...selectionBase,
					id: "selection-reference-1",
					sourceType: "reference",
					sourceId: "reference-1",
					sourceTextSnapshot: "Jane Smith",
					sourceDataSnapshot: {
						name: "Jane Smith",
						issuer: "Bioarbor",
						date: "2025",
						description: "Strong recommendation",
					},
				},
				{
					...selectionBase,
					id: "selection-license-1",
					sourceType: "license",
					sourceId: "license-1",
					sourceTextSnapshot: "Driving Licence B",
					sourceDataSnapshot: {
						name: "Driving Licence B",
						date: "2008",
						description: "Category B",
					},
				},
			],
			generatedContent: [],
			targetLanguage: "en-US",
		});

		expect(result.sections.education.items).toEqual([
			expect.objectContaining({
				id: "selection-education-1",
				hidden: false,
				school: "University of Wroclaw",
				degree: "MSc",
				area: "Biology - Ecology",
				period: "2005 - 2010",
				description: "<p>Environmental biology</p>",
			}),
		]);

		expect(result.sections.certifications.items).toEqual([
			expect.objectContaining({
				id: "selection-certification-1",
				hidden: false,
				title: "Project Management",
				issuer: "PM Academy",
				date: "2025-06",
				description: "<p>Advanced course</p>",
			}),
			expect.objectContaining({
				id: "selection-license-1",
				hidden: false,
				title: "Driving Licence B",
				issuer: "",
				date: "2008",
				description: "<p>Category B</p>",
			}),
		]);

		expect(result.sections.volunteer.items).toEqual([
			expect.objectContaining({
				id: "selection-volunteer-1",
				hidden: false,
				organization: "Green Foundation",
				period: "2024",
				description: "<p>Coordinator</p><p>Organized environmental projects</p>",
			}),
		]);

		expect(result.sections.languages.items).toEqual([
			expect.objectContaining({
				id: "selection-language-1",
				hidden: false,
				language: "English",
				fluency: "B2",
				level: 0,
			}),
		]);

		expect(result.sections.awards.items).toEqual([
			expect.objectContaining({
				id: "selection-award-1",
				hidden: false,
				title: "Best Project",
				awarder: "Industry Association",
				date: "2025",
				description: "<p>Awarded for 1story</p>",
			}),
		]);

		expect(result.sections.references.items).toEqual([
			expect.objectContaining({
				id: "selection-reference-1",
				hidden: false,
				name: "Jane Smith",
				position: "Bioarbor",
				description: "<p>Strong recommendation</p>",
			}),
		]);
	});

	it("maps a selected employment with selected child facts into one experience item", () => {
		const result = createResumeDataFromCvmate({
			profile: masterProfile,
			selectionItems: [
				{
					id: "selection-employment-1",
					cvBuildId: "build-1",
					parentSelectionItemId: null,
					sourceType: "employment",
					sourceId: "employment-1",
					sourceTextSnapshot: "Bioarbor",
					sourceDataSnapshot: {
						company: "Bioarbor",
						jobTitle: "Project Coordinator",
						location: "Wroclaw",
						startDate: "2023-01",
						endDate: "2025-06",
						isCurrent: false,
					},
					recommended: true,
					selected: true,
					recommendationReason: "Relevant employment",
					sortOrder: 0,
					createdAt: now,
					updatedAt: now,
				},
				{
					id: "selection-fact-1",
					cvBuildId: "build-1",
					parentSelectionItemId: "selection-employment-1",
					sourceType: "experience_fact",
					sourceId: "fact-1",
					sourceTextSnapshot: "Prepared public procurement offers",
					sourceDataSnapshot: {
						text: "Prepared public procurement offers",
					},
					recommended: true,
					selected: true,
					recommendationReason: "Relevant fact",
					sortOrder: 0,
					createdAt: now,
					updatedAt: now,
				},
				{
					id: "selection-fact-2",
					cvBuildId: "build-1",
					parentSelectionItemId: "selection-employment-1",
					sourceType: "experience_fact",
					sourceId: "fact-2",
					sourceTextSnapshot: "Coordinated client communication",
					sourceDataSnapshot: {
						text: "Coordinated client communication",
					},
					recommended: true,
					selected: true,
					recommendationReason: "Relevant fact",
					sortOrder: 1,
					createdAt: now,
					updatedAt: now,
				},
			],
			generatedContent: [],
			targetLanguage: "en-US",
		});

		expect(result.sections.experience.items).toEqual([
			expect.objectContaining({
				id: "selection-employment-1",
				hidden: false,
				company: "Bioarbor",
				position: "Project Coordinator",
				location: "Wroclaw",
				period: "2023-01 - 2025-06",
				description: "<ul><li>Prepared public procurement offers</li><li>Coordinated client communication</li></ul>",
				roles: [],
			}),
		]);
	});

	it("rejects a selected experience fact without a selected employment parent", () => {
		let error: unknown;

		try {
			createResumeDataFromCvmate({
				profile: masterProfile,
				selectionItems: [
					{
						id: "selection-orphan-fact",
						cvBuildId: "build-1",
						parentSelectionItemId: null,
						sourceType: "experience_fact",
						sourceId: "fact-orphan",
						sourceTextSnapshot: "Orphan fact",
						sourceDataSnapshot: {
							text: "Orphan fact",
						},
						recommended: true,
						selected: true,
						recommendationReason: null,
						sortOrder: 0,
						createdAt: now,
						updatedAt: now,
					},
				],
				generatedContent: [],
				targetLanguage: "en-US",
			});
		} catch (caught) {
			error = caught;
		}

		expect(error).toMatchObject({
			code: "BAD_REQUEST",
			message: "A selected experience fact must belong to a selected employment.",
		});
	});
	it("maps list items and summary-backed custom content into renderable resume sections", () => {
		const selectionBase = {
			cvBuildId: "build-1",
			parentSelectionItemId: null,
			recommended: true,
			selected: true,
			recommendationReason: "Relevant",
			sortOrder: 0,
			createdAt: now,
			updatedAt: now,
		};

		const result = createResumeDataFromCvmate({
			profile: masterProfile,
			selectionItems: [
				{
					...selectionBase,
					id: "selection-skill-1",
					sourceType: "profile_list_item",
					sourceId: "list-skill-1",
					sourceTextSnapshot: "Public procurement",
					sourceDataSnapshot: {
						kind: "competency",
						value: "Public procurement",
					},
				},
				{
					...selectionBase,
					id: "selection-tool-1",
					sourceType: "profile_list_item",
					sourceId: "list-tool-1",
					sourceTextSnapshot: "Bitrix24",
					sourceDataSnapshot: {
						kind: "tool",
						value: "Bitrix24",
					},
				},
				{
					...selectionBase,
					id: "selection-interest-1",
					sourceType: "profile_list_item",
					sourceId: "list-interest-1",
					sourceTextSnapshot: "Gardening",
					sourceDataSnapshot: {
						kind: "interest",
						value: "Gardening",
					},
				},
				{
					...selectionBase,
					id: "selection-course-1",
					sourceType: "course",
					sourceId: "course-1",
					sourceTextSnapshot: "Advanced Excel",
					sourceDataSnapshot: {
						name: "Advanced Excel",
						organizer: "Training Academy",
						date: "2025",
						description: "Practical spreadsheet training",
					},
				},
				{
					...selectionBase,
					id: "selection-clause-1",
					sourceType: "clause",
					sourceId: "clause-1",
					sourceTextSnapshot: "Recruitment consent",
					sourceDataSnapshot: {
						scope: "current",
						language: "en",
						isEnabled: true,
						content: "I consent to the processing of my personal data.",
					},
				},
				{
					...selectionBase,
					id: "selection-custom-1",
					sourceType: "custom_section_item",
					sourceId: "custom-item-1",
					sourceTextSnapshot: "Additional achievement",
					sourceDataSnapshot: {
						title: "Additional achievement",
						subtitle: "Community project",
						date: "2024",
						description: "Coordinated a local initiative",
						url: "https://example.com/project",
						fields: null,
						section: {
							id: "profile-section-1",
							kind: "custom",
							title: "Additional Information",
							isVisible: true,
							sortOrder: 0,
						},
					},
				},
			],
			generatedContent: [],
			targetLanguage: "en-US",
		});

		expect(result.sections.skills.items).toEqual([
			{
				id: "selection-skill-1",
				hidden: false,
				icon: "",
				iconColor: "",
				name: "Public procurement",
				proficiency: "",
				level: 0,
				keywords: [],
			},
			{
				id: "selection-tool-1",
				hidden: false,
				icon: "",
				iconColor: "",
				name: "Bitrix24",
				proficiency: "",
				level: 0,
				keywords: [],
			},
		]);

		expect(result.sections.interests.items).toEqual([
			{
				id: "selection-interest-1",
				hidden: false,
				icon: "",
				iconColor: "",
				name: "Gardening",
				keywords: [],
			},
		]);

		expect(result.customSections).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "cvmate-courses",
					type: "summary",
					title: "Courses",
					items: [
						{
							id: "selection-course-1",
							hidden: false,
							content: "<p>Advanced Excel</p><p>Training Academy</p><p>2025</p><p>Practical spreadsheet training</p>",
						},
					],
				}),
				expect.objectContaining({
					id: "cvmate-clauses",
					type: "summary",
					title: "Clauses",
					items: [
						{
							id: "selection-clause-1",
							hidden: false,
							content: "<p>I consent to the processing of my personal data.</p>",
						},
					],
				}),
				expect.objectContaining({
					id: "cvmate-custom-profile-section-1",
					type: "summary",
					title: "Additional Information",
					items: [
						{
							id: "selection-custom-1",
							hidden: false,
							content:
								"<p>Additional achievement</p><p>Community project</p><p>2024</p><p>Coordinated a local initiative</p><p>https://example.com/project</p>",
						},
					],
				}),
			]),
		);

		expect(result.metadata.layout.pages[0]?.main).toEqual(
			expect.arrayContaining(["cvmate-courses", "cvmate-clauses", "cvmate-custom-profile-section-1"]),
		);
	});

	it("applies generated content, summary, LinkedIn and profile photo to canonical resume data", () => {
		const result = createResumeDataFromCvmate({
			profile: {
				...masterProfile,
				profile: {
					...masterProfile.profile,
					linkedinUrl: "https://www.linkedin.com/in/aga-nowak",
				},
			},
			selectionItems: [
				{
					id: "selection-current-employment",
					cvBuildId: "build-1",
					parentSelectionItemId: null,
					sourceType: "employment",
					sourceId: "employment-current",
					sourceTextSnapshot: "Current Company",
					sourceDataSnapshot: {
						company: "Current Company",
						jobTitle: "Coordinator",
						location: "Wroclaw",
						startDate: "2023",
						endDate: null,
						isCurrent: true,
					},
					recommended: true,
					selected: true,
					recommendationReason: null,
					sortOrder: 0,
					createdAt: now,
					updatedAt: now,
				},
				{
					id: "selection-generated-fact",
					cvBuildId: "build-1",
					parentSelectionItemId: "selection-current-employment",
					sourceType: "experience_fact",
					sourceId: "fact-generated",
					sourceTextSnapshot: "Original fact",
					sourceDataSnapshot: {
						text: "Original fact",
					},
					recommended: true,
					selected: true,
					recommendationReason: null,
					sortOrder: 0,
					createdAt: now,
					updatedAt: now,
				},
				{
					id: "selection-photo-1",
					cvBuildId: "build-1",
					parentSelectionItemId: null,
					sourceType: "profile_photo",
					sourceId: "photo-1",
					sourceTextSnapshot: "photo.jpg",
					sourceDataSnapshot: {
						storageKey: "uploads/user-1/profile/photo.jpg",
					},
					recommended: true,
					selected: true,
					recommendationReason: null,
					sortOrder: 0,
					createdAt: now,
					updatedAt: now,
				},
			],
			generatedContent: [
				{
					id: "generated-summary-1",
					cvBuildId: "build-1",
					selectionItemId: null,
					kind: "professional_summary",
					sourceText: "Original summary",
					sourceDataSnapshot: {},
					aiText: "AI summary",
					finalText: "Experienced coordinator & project specialist",
					model: null,
					promptVersion: null,
					createdAt: new Date("2026-09-10T10:00:00.000Z"),
					updatedAt: new Date("2026-09-10T10:00:00.000Z"),
				},
				{
					id: "generated-fact-old",
					cvBuildId: "build-1",
					selectionItemId: "selection-generated-fact",
					kind: "experience_fact",
					sourceText: "Original fact",
					sourceDataSnapshot: {},
					aiText: "Older AI fact",
					finalText: "Older final fact",
					model: null,
					promptVersion: null,
					createdAt: new Date("2026-09-10T10:00:00.000Z"),
					updatedAt: new Date("2026-09-10T10:00:00.000Z"),
				},
				{
					id: "generated-fact-new",
					cvBuildId: "build-1",
					selectionItemId: "selection-generated-fact",
					kind: "experience_fact",
					sourceText: "Original fact",
					sourceDataSnapshot: {},
					aiText: "Newest AI fact",
					finalText: "Final tailored fact <100%>",
					model: null,
					promptVersion: null,
					createdAt: new Date("2026-09-10T11:00:00.000Z"),
					updatedAt: new Date("2026-09-10T11:00:00.000Z"),
				},
			],
			targetLanguage: "en-US",
		});

		expect(result.summary.content).toBe("<p>Experienced coordinator &amp; project specialist</p>");

		expect(result.sections.experience.items).toEqual([
			expect.objectContaining({
				id: "selection-current-employment",
				period: "2023 - Present",
				description: "<ul><li>Final tailored fact &lt;100%&gt;</li></ul>",
			}),
		]);

		expect(result.sections.profiles.items).toEqual([
			{
				id: "cvmate-linkedin",
				hidden: false,
				icon: "",
				iconColor: "",
				network: "LinkedIn",
				username: "",
				website: {
					url: "https://www.linkedin.com/in/aga-nowak",
					label: "https://www.linkedin.com/in/aga-nowak",
					inlineLink: false,
				},
			},
		]);

		expect(result.picture.hidden).toBe(false);
		expect(result.picture.url).toContain("uploads/user-1/profile/photo.jpg");
	});

	it("rejects multiple selected profile photos", () => {
		const photoSelection = {
			cvBuildId: "build-1",
			parentSelectionItemId: null,
			sourceType: "profile_photo" as const,
			sourceTextSnapshot: "photo.jpg",
			recommended: true,
			selected: true,
			recommendationReason: null,
			sortOrder: 0,
			createdAt: now,
			updatedAt: now,
		};

		expect(() =>
			createResumeDataFromCvmate({
				profile: masterProfile,
				selectionItems: [
					{
						...photoSelection,
						id: "selection-photo-a",
						sourceId: "photo-a",
						sourceDataSnapshot: {
							storageKey: "uploads/user-1/profile/a.jpg",
						},
					},
					{
						...photoSelection,
						id: "selection-photo-b",
						sourceId: "photo-b",
						sourceDataSnapshot: {
							storageKey: "uploads/user-1/profile/b.jpg",
						},
					},
				],
				generatedContent: [],
				targetLanguage: "en-US",
			}),
		).toThrow();
	});
});
