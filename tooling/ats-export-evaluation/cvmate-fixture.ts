import type { SyntheticCorpus } from "./fixture";
import type { ExpectedToken } from "./metrics";
import { createResumeDataFromCvmate } from "@reactive-resume/api/features/cvmate-build/resume-adapter";

const now = new Date("2026-09-12T12:00:00.000Z");

const token = (value: string, group: string): ExpectedToken => ({ value, group });

export function createCvmatePdfCorpus(): SyntheticCorpus {
	const profile = {
		profile: {
			id: "profile-cvmate-export",
			firstName: "Aga",
			lastName: "Nowak",
			email: "aga@example.com",
			phone: "+48 500 600 700",
			location: "Wrocław",
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

	const selectionBase = {
		cvBuildId: "build-cvmate-export",
		parentSelectionItemId: null,
		recommended: true,
		selected: true,
		recommendationReason: "Export contract fixture",
		sortOrder: 0,
		createdAt: now,
		updatedAt: now,
	};

	const data = createResumeDataFromCvmate({
		profile,
		selectionItems: [
			{
				...selectionBase,
				id: "selection-employment",
				sourceType: "employment",
				sourceId: "employment-1",
				sourceTextSnapshot: "Bioarbor",
				sourceDataSnapshot: {
					company: "Bioarbor",
					jobTitle: "Project Coordinator",
					location: "Wrocław",
					startDate: "2023-01",
					endDate: "2025-06",
					isCurrent: false,
				},
			},
			{
				...selectionBase,
				id: "selection-fact-offers",
				parentSelectionItemId: "selection-employment",
				sourceType: "experience_fact",
				sourceId: "fact-1",
				sourceTextSnapshot: "Prepared public procurement offers",
				sourceDataSnapshot: {
					text: "Prepared public procurement offers",
				},
			},
			{
				...selectionBase,
				id: "selection-fact-clients",
				parentSelectionItemId: "selection-employment",
				sourceType: "experience_fact",
				sourceId: "fact-2",
				sourceTextSnapshot: "Coordinated client communication",
				sourceDataSnapshot: {
					text: "Coordinated client communication",
				},
				sortOrder: 1,
			},
			{
				...selectionBase,
				id: "selection-education",
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
				id: "selection-skill",
				sourceType: "profile_list_item",
				sourceId: "skill-1",
				sourceTextSnapshot: "Public procurement",
				sourceDataSnapshot: {
					kind: "competency",
					value: "Public procurement",
				},
			},
			{
				...selectionBase,
				id: "selection-tool",
				sourceType: "profile_list_item",
				sourceId: "tool-1",
				sourceTextSnapshot: "Bitrix24",
				sourceDataSnapshot: {
					kind: "tool",
					value: "Bitrix24",
				},
				sortOrder: 1,
			},
			{
				...selectionBase,
				id: "selection-language",
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
				id: "selection-project",
				sourceType: "project",
				sourceId: "project-1",
				sourceTextSnapshot: "CVMate Export Contract",
				sourceDataSnapshot: {
					name: "CVMate Export Contract",
					startDate: "2026",
					endDate: "2026",
					description: "PDF export verification",
				},
			},
			{
				...selectionBase,
				id: "selection-unselected-project",
				sourceType: "project",
				sourceId: "project-unselected",
				sourceTextSnapshot: "Hidden CVMate Project",
				sourceDataSnapshot: {
					name: "Hidden CVMate Project",
					startDate: "2020",
					endDate: "2021",
					description: "hidden-cvmate-export-marker",
				},
				selected: false,
				recommended: false,
				recommendationReason: null,
			},
		],
		generatedContent: [],
		targetLanguage: "pl",
	});

	const tokens: readonly ExpectedToken[] = [
		...["Aga Nowak", "aga@example.com", "+48 500 600 700", "Wrocław", "https://example.com"].map((value) =>
			token(value, "header"),
		),
		...[
			"Bioarbor",
			"Project Coordinator",
			"Wrocław",
			"2023-01 - 2025-06",
			"Prepared public procurement offers",
			"Coordinated client communication",
		].map((value) => token(value, "experience")),
		...["University of Wroclaw", "MSc", "Biology - Ecology", "2005 - 2010", "Environmental biology"].map((value) =>
			token(value, "education"),
		),
		...["Public procurement", "Bitrix24"].map((value) => token(value, "skills")),
		...["English", "B2"].map((value) => token(value, "languages")),
		...["CVMate Export Contract", "2026 - 2026", "PDF export verification"].map((value) => token(value, "projects")),
	];

	return {
		name: "cvmate-pdf-contract",
		tokens,
		data,
		hiddenTokens: ["Hidden CVMate Project", "hidden-cvmate-export-marker"],
		links: ["https://example.com", "mailto:aga@example.com", "tel:+48 500 600 700"],
	};
}
