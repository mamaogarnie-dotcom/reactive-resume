import { useMutation, useQuery } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import { orpc } from "@/libs/orpc/client";

type ProfileAggregate = NonNullable<
	Awaited<ReturnType<typeof orpc.cvmateProfile.getCurrent.call>>
>;

type DetailedKind =
	| "project"
	| "education"
	| "course"
	| "certification"
	| "volunteer"
	| "language"
	| "award"
	| "reference"
	| "license";

type ListKind = "competency" | "software" | "tool" | "interest";
type FormValues = Record<string, string>;
type GenericItem = Record<string, unknown> & { id: string; sortOrder: number };

type FieldDefinition = {
	key: string;
	label: string;
	placeholder?: string;
	type?: "text" | "url";
	multiline?: boolean;
	wide?: boolean;
};

type DetailedDefinition = {
	kind: DetailedKind;
	title: string;
	description: string;
	fields: readonly FieldDefinition[];
};

const inputClassName =
	"h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";
const textareaClassName =
	"min-h-20 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm";

const detailedDefinitions: readonly DetailedDefinition[] = [
	{
		kind: "project",
		title: "Projects",
		description: "Projects that may strengthen a tailored CV.",
		fields: [
			{ key: "name", label: "Name" },
			{ key: "company", label: "Company / client" },
			{
				key: "startDate",
				label: "Start date",
				placeholder: "YYYY, YYYY-MM or YYYY-MM-DD",
			},
			{
				key: "endDate",
				label: "End date",
				placeholder: "YYYY, YYYY-MM or YYYY-MM-DD",
			},
			{ key: "description", label: "Description", multiline: true, wide: true },
		],
	},
	{
		kind: "education",
		title: "Education",
		description: "Schools, universities and other formal education.",
		fields: [
			{ key: "institution", label: "Institution" },
			{ key: "fieldOfStudy", label: "Field of study" },
			{ key: "specialization", label: "Specialization" },
			{ key: "degree", label: "Degree" },
			{
				key: "startDate",
				label: "Start date",
				placeholder: "YYYY, YYYY-MM or YYYY-MM-DD",
			},
			{
				key: "endDate",
				label: "End date",
				placeholder: "YYYY, YYYY-MM or YYYY-MM-DD",
			},
			{ key: "description", label: "Description", multiline: true, wide: true },
		],
	},
	{
		kind: "course",
		title: "Courses",
		description: "Courses and training completed during your career.",
		fields: [
			{ key: "name", label: "Course name" },
			{ key: "organizer", label: "Organizer" },
			{
				key: "date",
				label: "Date",
				placeholder: "YYYY, YYYY-MM or YYYY-MM-DD",
			},
			{ key: "description", label: "Description", multiline: true, wide: true },
		],
	},
	{
		kind: "certification",
		title: "Certifications",
		description: "Certificates, credentials and professional qualifications.",
		fields: [
			{ key: "name", label: "Certification" },
			{ key: "issuingOrganization", label: "Issuing organization" },
			{
				key: "issueDate",
				label: "Issue date",
				placeholder: "YYYY, YYYY-MM or YYYY-MM-DD",
			},
			{
				key: "expiryDate",
				label: "Expiry date",
				placeholder: "YYYY, YYYY-MM or YYYY-MM-DD",
			},
			{ key: "credentialNumber", label: "Credential number" },
			{
				key: "credentialUrl",
				label: "Credential URL",
				type: "url",
				placeholder: "https://...",
			},
			{ key: "description", label: "Description", multiline: true, wide: true },
		],
	},
	{
		kind: "volunteer",
		title: "Volunteer work",
		description: "Volunteer roles that can be relevant to an application.",
		fields: [
			{ key: "organization", label: "Organization" },
			{ key: "role", label: "Role" },
			{
				key: "date",
				label: "Date",
				placeholder: "YYYY, YYYY-MM or YYYY-MM-DD",
			},
			{ key: "description", label: "Description", multiline: true, wide: true },
		],
	},
	{
		kind: "language",
		title: "Languages",
		description: "Languages and your level of proficiency.",
		fields: [
			{ key: "language", label: "Language" },
			{ key: "level", label: "Level" },
		],
	},
	{
		kind: "award",
		title: "Awards",
		description:
			"Awards and distinctions worth keeping in your career profile.",
		fields: [
			{ key: "name", label: "Award" },
			{ key: "organizer", label: "Organizer" },
			{
				key: "date",
				label: "Date",
				placeholder: "YYYY, YYYY-MM or YYYY-MM-DD",
			},
			{ key: "description", label: "Description", multiline: true, wide: true },
		],
	},
	{
		kind: "reference",
		title: "References",
		description: "Professional references and recommendations.",
		fields: [
			{ key: "name", label: "Reference / person" },
			{ key: "issuer", label: "Issuer / organization" },
			{
				key: "date",
				label: "Date",
				placeholder: "YYYY, YYYY-MM or YYYY-MM-DD",
			},
			{ key: "description", label: "Description", multiline: true, wide: true },
		],
	},
	{
		kind: "license",
		title: "Licenses",
		description: "Licenses, permits and other formal authorizations.",
		fields: [
			{ key: "name", label: "License" },
			{
				key: "date",
				label: "Date",
				placeholder: "YYYY, YYYY-MM or YYYY-MM-DD",
			},
			{ key: "description", label: "Description", multiline: true, wide: true },
		],
	},
];

const listDefinitions: readonly {
	kind: ListKind;
	title: string;
	placeholder: string;
}[] = [
	{ kind: "competency", title: "Skills", placeholder: "Add a skill" },
	{ kind: "software", title: "Software", placeholder: "Add software" },
	{ kind: "tool", title: "Tools", placeholder: "Add a tool" },
	{ kind: "interest", title: "Interests", placeholder: "Add an interest" },
];

function nullable(value: string | undefined) {
	const trimmed = value?.trim() ?? "";
	return trimmed.length > 0 ? trimmed : null;
}

function emptyValues(fields: readonly FieldDefinition[]): FormValues {
	return Object.fromEntries(fields.map((field) => [field.key, ""]));
}

function itemToValues(
	item: GenericItem,
	fields: readonly FieldDefinition[],
): FormValues {
	return Object.fromEntries(
		fields.map((field) => {
			const value = item[field.key];
			return [field.key, typeof value === "string" ? value : ""];
		}),
	);
}

function getDetailedItems(
	profile: ProfileAggregate | null | undefined,
	kind: DetailedKind,
): GenericItem[] {
	if (!profile) return [];

	switch (kind) {
		case "project":
			return profile.projects as unknown as GenericItem[];
		case "education":
			return profile.education as unknown as GenericItem[];
		case "course":
			return profile.courses as unknown as GenericItem[];
		case "certification":
			return profile.certifications as unknown as GenericItem[];
		case "volunteer":
			return profile.volunteer as unknown as GenericItem[];
		case "language":
			return profile.languages as unknown as GenericItem[];
		case "award":
			return profile.awards as unknown as GenericItem[];
		case "reference":
			return profile.references as unknown as GenericItem[];
		case "license":
			return profile.licenses as unknown as GenericItem[];
	}
}

async function createDetailed(
	kind: DetailedKind,
	values: FormValues,
	sortOrder: number,
) {
	switch (kind) {
		case "project":
			return orpc.cvmateProfile.createProject.call({
				name: nullable(values.name),
				company: nullable(values.company),
				startDate: nullable(values.startDate),
				endDate: nullable(values.endDate),
				description: nullable(values.description),
				sortOrder,
			});
		case "education":
			return orpc.cvmateProfile.createEducation.call({
				institution: nullable(values.institution),
				fieldOfStudy: nullable(values.fieldOfStudy),
				specialization: nullable(values.specialization),
				degree: nullable(values.degree),
				startDate: nullable(values.startDate),
				endDate: nullable(values.endDate),
				description: nullable(values.description),
				sortOrder,
			});
		case "course":
			return orpc.cvmateProfile.createCourse.call({
				name: nullable(values.name),
				organizer: nullable(values.organizer),
				date: nullable(values.date),
				description: nullable(values.description),
				sortOrder,
			});
		case "certification":
			return orpc.cvmateProfile.createCertification.call({
				name: nullable(values.name),
				issuingOrganization: nullable(values.issuingOrganization),
				issueDate: nullable(values.issueDate),
				expiryDate: nullable(values.expiryDate),
				credentialNumber: nullable(values.credentialNumber),
				credentialUrl: nullable(values.credentialUrl),
				description: nullable(values.description),
				sortOrder,
			});
		case "volunteer":
			return orpc.cvmateProfile.createVolunteer.call({
				organization: nullable(values.organization),
				role: nullable(values.role),
				date: nullable(values.date),
				description: nullable(values.description),
				sortOrder,
			});
		case "language":
			return orpc.cvmateProfile.createLanguage.call({
				language: nullable(values.language),
				level: nullable(values.level),
				sortOrder,
			});
		case "award":
			return orpc.cvmateProfile.createAward.call({
				name: nullable(values.name),
				organizer: nullable(values.organizer),
				date: nullable(values.date),
				description: nullable(values.description),
				sortOrder,
			});
		case "reference":
			return orpc.cvmateProfile.createReference.call({
				name: nullable(values.name),
				issuer: nullable(values.issuer),
				date: nullable(values.date),
				description: nullable(values.description),
				sortOrder,
			});
		case "license":
			return orpc.cvmateProfile.createLicense.call({
				name: nullable(values.name),
				date: nullable(values.date),
				description: nullable(values.description),
				sortOrder,
			});
	}
}

async function updateDetailed(
	kind: DetailedKind,
	id: string,
	values: FormValues,
) {
	switch (kind) {
		case "project":
			return orpc.cvmateProfile.updateProject.call({
				id,
				name: nullable(values.name),
				company: nullable(values.company),
				startDate: nullable(values.startDate),
				endDate: nullable(values.endDate),
				description: nullable(values.description),
			});
		case "education":
			return orpc.cvmateProfile.updateEducation.call({
				id,
				institution: nullable(values.institution),
				fieldOfStudy: nullable(values.fieldOfStudy),
				specialization: nullable(values.specialization),
				degree: nullable(values.degree),
				startDate: nullable(values.startDate),
				endDate: nullable(values.endDate),
				description: nullable(values.description),
			});
		case "course":
			return orpc.cvmateProfile.updateCourse.call({
				id,
				name: nullable(values.name),
				organizer: nullable(values.organizer),
				date: nullable(values.date),
				description: nullable(values.description),
			});
		case "certification":
			return orpc.cvmateProfile.updateCertification.call({
				id,
				name: nullable(values.name),
				issuingOrganization: nullable(values.issuingOrganization),
				issueDate: nullable(values.issueDate),
				expiryDate: nullable(values.expiryDate),
				credentialNumber: nullable(values.credentialNumber),
				credentialUrl: nullable(values.credentialUrl),
				description: nullable(values.description),
			});
		case "volunteer":
			return orpc.cvmateProfile.updateVolunteer.call({
				id,
				organization: nullable(values.organization),
				role: nullable(values.role),
				date: nullable(values.date),
				description: nullable(values.description),
			});
		case "language":
			return orpc.cvmateProfile.updateLanguage.call({
				id,
				language: nullable(values.language),
				level: nullable(values.level),
			});
		case "award":
			return orpc.cvmateProfile.updateAward.call({
				id,
				name: nullable(values.name),
				organizer: nullable(values.organizer),
				date: nullable(values.date),
				description: nullable(values.description),
			});
		case "reference":
			return orpc.cvmateProfile.updateReference.call({
				id,
				name: nullable(values.name),
				issuer: nullable(values.issuer),
				date: nullable(values.date),
				description: nullable(values.description),
			});
		case "license":
			return orpc.cvmateProfile.updateLicense.call({
				id,
				name: nullable(values.name),
				date: nullable(values.date),
				description: nullable(values.description),
			});
	}
}

async function deleteDetailed(kind: DetailedKind, id: string) {
	switch (kind) {
		case "project":
			return orpc.cvmateProfile.deleteProject.call({ id });
		case "education":
			return orpc.cvmateProfile.deleteEducation.call({ id });
		case "course":
			return orpc.cvmateProfile.deleteCourse.call({ id });
		case "certification":
			return orpc.cvmateProfile.deleteCertification.call({ id });
		case "volunteer":
			return orpc.cvmateProfile.deleteVolunteer.call({ id });
		case "language":
			return orpc.cvmateProfile.deleteLanguage.call({ id });
		case "award":
			return orpc.cvmateProfile.deleteAward.call({ id });
		case "reference":
			return orpc.cvmateProfile.deleteReference.call({ id });
		case "license":
			return orpc.cvmateProfile.deleteLicense.call({ id });
	}
}

function RecordFields({
	fields,
	values,
	disabled,
	onChange,
}: {
	fields: readonly FieldDefinition[];
	values: FormValues;
	disabled: boolean;
	onChange: (key: string, value: string) => void;
}) {
	return (
		<div className="grid gap-3 md:grid-cols-2">
			{fields.map((field) => (
				<div
					key={field.key}
					className={`space-y-1 text-sm ${field.wide ? "md:col-span-2" : ""}`}
				>
					<span className="font-medium">{field.label}</span>
					{field.multiline ? (
						<textarea
							className={textareaClassName}
							placeholder={field.placeholder}
							value={values[field.key] ?? ""}
							disabled={disabled}
							onChange={(event) => onChange(field.key, event.target.value)}
						/>
					) : (
						<input
							className={inputClassName}
							type={field.type ?? "text"}
							placeholder={field.placeholder}
							value={values[field.key] ?? ""}
							disabled={disabled}
							onChange={(event) => onChange(field.key, event.target.value)}
						/>
					)}
				</div>
			))}
		</div>
	);
}

function DetailedSection({ definition }: { definition: DetailedDefinition }) {
	const profileQuery = useQuery(
		orpc.cvmateProfile.getCurrent.queryOptions({ input: {} }),
	);
	const [form, setForm] = useState<FormValues>(() =>
		emptyValues(definition.fields),
	);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editForm, setEditForm] = useState<FormValues>(() =>
		emptyValues(definition.fields),
	);

	const items = getDetailedItems(profileQuery.data, definition.kind)
		.slice()
		.sort((a, b) => a.sortOrder - b.sortOrder);

	const createMutation = useMutation({
		mutationFn: () => createDetailed(definition.kind, form, items.length),
		onSuccess: () => {
			setForm(emptyValues(definition.fields));
			void profileQuery.refetch();
		},
	});

	const updateMutation = useMutation({
		mutationFn: () => {
			if (!editingId) throw new Error("No profile record selected.");
			return updateDetailed(definition.kind, editingId, editForm);
		},
		onSuccess: () => {
			setEditingId(null);
			setEditForm(emptyValues(definition.fields));
			void profileQuery.refetch();
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => deleteDetailed(definition.kind, id),
		onSuccess: () => void profileQuery.refetch(),
	});

	const hasCreateContent = Object.values(form).some(
		(value) => value.trim().length > 0,
	);
	const hasEditContent = Object.values(editForm).some(
		(value) => value.trim().length > 0,
	);

	return (
		<section className="space-y-4">
			<div>
				<h2 className="text-lg font-semibold">{definition.title}</h2>
				<p className="text-sm text-muted-foreground">
					{definition.description}
				</p>
			</div>

			<form
				className="space-y-3 rounded-md border p-4"
				onSubmit={(event: FormEvent<HTMLFormElement>) => {
					event.preventDefault();
					if (hasCreateContent) createMutation.mutate();
				}}
			>
				<RecordFields
					fields={definition.fields}
					values={form}
					disabled={createMutation.isPending}
					onChange={(key, value) =>
						setForm((current) => ({ ...current, [key]: value }))
					}
				/>
				<button
					type="submit"
					className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
					disabled={!hasCreateContent || createMutation.isPending}
				>
					{createMutation.isPending
						? "Adding..."
						: `Add ${definition.title.toLowerCase()}`}
				</button>
				{createMutation.isError ? (
					<p className="text-sm text-destructive">Could not add this record.</p>
				) : null}
			</form>

			<div className="space-y-2">
				{profileQuery.isLoading ? (
					<p className="text-sm text-muted-foreground">Loading...</p>
				) : null}
				{!profileQuery.isLoading && items.length === 0 ? (
					<p className="text-sm text-muted-foreground">No records added yet.</p>
				) : null}

				{items.map((item) => (
					<div key={item.id} className="rounded-md border p-3">
						{editingId === item.id ? (
							<div className="space-y-3">
								<RecordFields
									fields={definition.fields}
									values={editForm}
									disabled={updateMutation.isPending}
									onChange={(key, value) =>
										setEditForm((current) => ({
											...current,
											[key]: value,
										}))
									}
								/>
								<div className="flex gap-2">
									<button
										type="button"
										className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
										disabled={!hasEditContent || updateMutation.isPending}
										onClick={() => updateMutation.mutate()}
									>
										{updateMutation.isPending ? "Saving..." : "Save"}
									</button>
									<button
										type="button"
										className="rounded-md border px-3 py-1.5 text-sm"
										disabled={updateMutation.isPending}
										onClick={() => setEditingId(null)}
									>
										Cancel
									</button>
								</div>
							</div>
						) : (
							<div className="flex items-start justify-between gap-4">
								<div className="min-w-0 space-y-1 text-sm">
									{definition.fields.map((field) => {
										const value = item[field.key];
										if (typeof value !== "string" || value.trim().length === 0)
											return null;

										return (
											<p key={field.key}>
												<span className="font-medium">{field.label}:</span>{" "}
												<span className="whitespace-pre-wrap">{value}</span>
											</p>
										);
									})}
								</div>
								<div className="flex shrink-0 gap-2">
									<button
										type="button"
										className="rounded-md border px-3 py-1.5 text-sm"
										onClick={() => {
											setEditingId(item.id);
											setEditForm(itemToValues(item, definition.fields));
										}}
									>
										Edit
									</button>
									<button
										type="button"
										className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
										disabled={deleteMutation.isPending}
										onClick={() => deleteMutation.mutate(item.id)}
									>
										Delete
									</button>
								</div>
							</div>
						)}
					</div>
				))}
			</div>
		</section>
	);
}

function ListSection({
	kind,
	title,
	placeholder,
}: {
	kind: ListKind;
	title: string;
	placeholder: string;
}) {
	const profileQuery = useQuery(
		orpc.cvmateProfile.getCurrent.queryOptions({ input: {} }),
	);
	const [value, setValue] = useState("");
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editValue, setEditValue] = useState("");

	const items = (profileQuery.data?.listItems ?? [])
		.filter((item) => item.kind === kind)
		.sort((a, b) => a.sortOrder - b.sortOrder);

	const createMutation = useMutation(
		orpc.cvmateProfile.createListItem.mutationOptions({
			onSuccess: () => {
				setValue("");
				void profileQuery.refetch();
			},
		}),
	);
	const updateMutation = useMutation(
		orpc.cvmateProfile.updateListItem.mutationOptions({
			onSuccess: () => {
				setEditingId(null);
				setEditValue("");
				void profileQuery.refetch();
			},
		}),
	);
	const deleteMutation = useMutation(
		orpc.cvmateProfile.deleteListItem.mutationOptions({
			onSuccess: () => void profileQuery.refetch(),
		}),
	);

	return (
		<section className="space-y-3">
			<h2 className="text-lg font-semibold">{title}</h2>
			<form
				className="flex gap-2"
				onSubmit={(event) => {
					event.preventDefault();
					const trimmed = value.trim();
					if (!trimmed) return;
					createMutation.mutate({
						kind,
						value: trimmed,
						sortOrder: items.length,
					});
				}}
			>
				<input
					className={`${inputClassName} flex-1`}
					placeholder={placeholder}
					value={value}
					disabled={createMutation.isPending}
					onChange={(event) => setValue(event.target.value)}
				/>
				<button
					type="submit"
					className="rounded-md border px-3 text-sm disabled:opacity-50"
					disabled={!value.trim() || createMutation.isPending}
				>
					Add
				</button>
			</form>

			<div className="flex flex-wrap gap-2">
				{items.map((item) =>
					editingId === item.id ? (
						<form
							key={item.id}
							className="flex gap-1"
							onSubmit={(event) => {
								event.preventDefault();
								const trimmed = editValue.trim();
								if (!trimmed) return;
								updateMutation.mutate({ id: item.id, value: trimmed });
							}}
						>
							<input
								className={inputClassName}
								value={editValue}
								onChange={(event) => setEditValue(event.target.value)}
							/>
							<button type="submit" className="rounded-md border px-2 text-sm">
								Save
							</button>
							<button
								type="button"
								className="rounded-md border px-2 text-sm"
								onClick={() => setEditingId(null)}
							>
								Cancel
							</button>
						</form>
					) : (
						<div
							key={item.id}
							className="flex items-center gap-1 rounded-md border px-2 py-1 text-sm"
						>
							<span>{item.value}</span>
							<button
								type="button"
								className="text-muted-foreground hover:text-foreground"
								onClick={() => {
									setEditingId(item.id);
									setEditValue(item.value);
								}}
							>
								Edit
							</button>
							<button
								type="button"
								className="text-muted-foreground hover:text-destructive"
								disabled={deleteMutation.isPending}
								onClick={() => deleteMutation.mutate({ id: item.id })}
							>
								Delete
							</button>
						</div>
					),
				)}
			</div>
			{!profileQuery.isLoading && items.length === 0 ? (
				<p className="text-sm text-muted-foreground">Nothing added yet.</p>
			) : null}
		</section>
	);
}

type ClauseKey = "current:pl" | "current:en" | "future:pl" | "future:en";
type ClauseDraft = { enabled: boolean; content: string };

const clauseDefinitions: readonly {
	key: ClauseKey;
	scope: "current" | "future";
	language: "pl" | "en";
	title: string;
}[] = [
	{
		key: "current:pl",
		scope: "current",
		language: "pl",
		title: "Current recruitment — Polish",
	},
	{
		key: "current:en",
		scope: "current",
		language: "en",
		title: "Current recruitment — English",
	},
	{
		key: "future:pl",
		scope: "future",
		language: "pl",
		title: "Future recruitment — Polish",
	},
	{
		key: "future:en",
		scope: "future",
		language: "en",
		title: "Future recruitment — English",
	},
];

function emptyClauseDrafts(): Record<ClauseKey, ClauseDraft> {
	return {
		"current:pl": { enabled: false, content: "" },
		"current:en": { enabled: false, content: "" },
		"future:pl": { enabled: false, content: "" },
		"future:en": { enabled: false, content: "" },
	};
}

function ClausesSection() {
	const profileQuery = useQuery(
		orpc.cvmateProfile.getCurrent.queryOptions({ input: {} }),
	);
	const [drafts, setDrafts] =
		useState<Record<ClauseKey, ClauseDraft>>(emptyClauseDrafts);

	useEffect(() => {
		const next = emptyClauseDrafts();

		for (const clause of profileQuery.data?.clauses ?? []) {
			const key = `${clause.scope}:${clause.language}` as ClauseKey;
			next[key] = {
				enabled: clause.isEnabled,
				content: clause.content ?? "",
			};
		}

		setDrafts(next);
	}, [profileQuery.data?.clauses]);

	const saveMutation = useMutation({
		mutationFn: (definition: (typeof clauseDefinitions)[number]) =>
			orpc.cvmateProfile.upsertClause.call({
				scope: definition.scope,
				language: definition.language,
				isEnabled: drafts[definition.key].enabled,
				content: nullable(drafts[definition.key].content),
			}),
		onSuccess: () => void profileQuery.refetch(),
	});

	return (
		<section className="space-y-4">
			<div>
				<h2 className="text-lg font-semibold">Recruitment clauses</h2>
				<p className="text-sm text-muted-foreground">
					Store reusable consent clauses and switch them on only when needed.
				</p>
			</div>

			<div className="grid gap-3 lg:grid-cols-2">
				{clauseDefinitions.map((definition) => {
					const draft = drafts[definition.key];

					return (
						<div
							key={definition.key}
							className="space-y-3 rounded-md border p-3"
						>
							<div className="flex items-center justify-between gap-3">
								<p className="font-medium text-sm">{definition.title}</p>
								<label className="flex items-center gap-2 text-sm">
									<input
										type="checkbox"
										checked={draft.enabled}
										onChange={(event) =>
											setDrafts((current) => ({
												...current,
												[definition.key]: {
													...current[definition.key],
													enabled: event.target.checked,
												},
											}))
										}
									/>
									Enabled
								</label>
							</div>
							<textarea
								className={textareaClassName}
								value={draft.content}
								onChange={(event) =>
									setDrafts((current) => ({
										...current,
										[definition.key]: {
											...current[definition.key],
											content: event.target.value,
										},
									}))
								}
							/>
							<button
								type="button"
								className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
								disabled={saveMutation.isPending}
								onClick={() => saveMutation.mutate(definition)}
							>
								{saveMutation.isPending ? "Saving..." : "Save clause"}
							</button>
						</div>
					);
				})}
			</div>
		</section>
	);
}

export function ProfileDetailsSection() {
	return (
		<div className="space-y-8">
			<div className="grid gap-6 md:grid-cols-2">
				{listDefinitions.map((definition) => (
					<ListSection key={definition.kind} {...definition} />
				))}
			</div>

			{detailedDefinitions.map((definition) => (
				<div key={definition.kind} className="space-y-6">
					<div className="border-t" />
					<DetailedSection definition={definition} />
				</div>
			))}

			<div className="border-t" />
			<ClausesSection />
		</div>
	);
}
