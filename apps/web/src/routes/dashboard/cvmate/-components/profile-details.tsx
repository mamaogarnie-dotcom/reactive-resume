import type { MessageDescriptor } from "@lingui/core";
import type { RecruitmentClauseLanguage, RecruitmentClauseScope } from "@reactive-resume/utils/recruitment-clause";
import type { FormEvent } from "react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@reactive-resume/ui/components/button";
import { Input } from "@reactive-resume/ui/components/input";
import { Textarea } from "@reactive-resume/ui/components/textarea";
import { getDefaultRecruitmentClause } from "@reactive-resume/utils/recruitment-clause";
import { orpc } from "@/libs/orpc/client";

type ProfileAggregate = NonNullable<Awaited<ReturnType<typeof orpc.cvmateProfile.getCurrent.call>>>;

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
	label: MessageDescriptor;
	placeholder?: MessageDescriptor;
	type?: "text" | "url";
	multiline?: boolean;
	wide?: boolean;
};

type DetailedDefinition = {
	kind: DetailedKind;
	title: MessageDescriptor;
	description: MessageDescriptor;
	fields: readonly FieldDefinition[];
};

const detailedDefinitions: readonly DetailedDefinition[] = [
	{
		kind: "project",
		title: msg`Projects`,
		description: msg`Projects that may strengthen a tailored CV.`,
		fields: [
			{ key: "name", label: msg`Project name` },
			{ key: "company", label: msg`Company / client` },
			{
				key: "startDate",
				label: msg`Start date`,
				placeholder: msg`YYYY, YYYY-MM or YYYY-MM-DD`,
			},
			{
				key: "endDate",
				label: msg`End date`,
				placeholder: msg`YYYY, YYYY-MM or YYYY-MM-DD`,
			},
			{
				key: "description",
				label: msg`Description`,
				multiline: true,
				wide: true,
			},
		],
	},
	{
		kind: "education",
		title: msg`Education`,
		description: msg`Schools, universities and other formal education.`,
		fields: [
			{ key: "institution", label: msg`Institution` },
			{ key: "fieldOfStudy", label: msg`Field of study` },
			{ key: "specialization", label: msg`Specialization` },
			{ key: "degree", label: msg`Degree` },
			{
				key: "startDate",
				label: msg`Start date`,
				placeholder: msg`YYYY, YYYY-MM or YYYY-MM-DD`,
			},
			{
				key: "endDate",
				label: msg`End date`,
				placeholder: msg`YYYY, YYYY-MM or YYYY-MM-DD`,
			},
			{
				key: "description",
				label: msg`Description`,
				multiline: true,
				wide: true,
			},
		],
	},
	{
		kind: "course",
		title: msg`Courses`,
		description: msg`Courses and training completed during your career.`,
		fields: [
			{ key: "name", label: msg`Course name` },
			{ key: "organizer", label: msg`Organizer` },
			{
				key: "date",
				label: msg`Date`,
				placeholder: msg`YYYY, YYYY-MM or YYYY-MM-DD`,
			},
			{
				key: "description",
				label: msg`Description`,
				multiline: true,
				wide: true,
			},
		],
	},
	{
		kind: "certification",
		title: msg`Certifications`,
		description: msg`Certificates, credentials and professional qualifications.`,
		fields: [
			{ key: "name", label: msg`Certification` },
			{ key: "issuingOrganization", label: msg`Issuing organization` },
			{
				key: "issueDate",
				label: msg`Issue date`,
				placeholder: msg`YYYY, YYYY-MM or YYYY-MM-DD`,
			},
			{
				key: "expiryDate",
				label: msg`Expiry date`,
				placeholder: msg`YYYY, YYYY-MM or YYYY-MM-DD`,
			},
			{ key: "credentialNumber", label: msg`Credential number` },
			{
				key: "credentialUrl",
				label: msg`Credential URL`,
				type: "url",
				placeholder: msg`https://...`,
			},
			{
				key: "description",
				label: msg`Description`,
				multiline: true,
				wide: true,
			},
		],
	},
	{
		kind: "volunteer",
		title: msg`Volunteer work`,
		description: msg`Volunteer roles that can be relevant to an application.`,
		fields: [
			{ key: "organization", label: msg`Organization` },
			{ key: "role", label: msg`Role` },
			{
				key: "date",
				label: msg`Date`,
				placeholder: msg`YYYY, YYYY-MM or YYYY-MM-DD`,
			},
			{
				key: "description",
				label: msg`Description`,
				multiline: true,
				wide: true,
			},
		],
	},
	{
		kind: "language",
		title: msg`Languages`,
		description: msg`Languages and your level of proficiency.`,
		fields: [
			{ key: "language", label: msg`Language` },
			{ key: "level", label: msg`Level` },
		],
	},
	{
		kind: "award",
		title: msg`Awards`,
		description: msg`Awards and distinctions worth keeping in your career profile.`,
		fields: [
			{ key: "name", label: msg`Award` },
			{ key: "organizer", label: msg`Organizer` },
			{
				key: "date",
				label: msg`Date`,
				placeholder: msg`YYYY, YYYY-MM or YYYY-MM-DD`,
			},
			{
				key: "description",
				label: msg`Description`,
				multiline: true,
				wide: true,
			},
		],
	},
	{
		kind: "reference",
		title: msg`References`,
		description: msg`Professional references and recommendations.`,
		fields: [
			{ key: "name", label: msg`Reference / person` },
			{ key: "issuer", label: msg`Issuer / organization` },
			{
				key: "date",
				label: msg`Date`,
				placeholder: msg`YYYY, YYYY-MM or YYYY-MM-DD`,
			},
			{
				key: "description",
				label: msg`Description`,
				multiline: true,
				wide: true,
			},
		],
	},
	{
		kind: "license",
		title: msg`Licenses`,
		description: msg`Licenses, permits and other formal authorizations.`,
		fields: [
			{ key: "name", label: msg`License` },
			{
				key: "date",
				label: msg`Date`,
				placeholder: msg`YYYY, YYYY-MM or YYYY-MM-DD`,
			},
			{
				key: "description",
				label: msg`Description`,
				multiline: true,
				wide: true,
			},
		],
	},
];

const listDefinitions: readonly {
	kind: ListKind;
	title: MessageDescriptor;
	placeholder: MessageDescriptor;
}[] = [
	{ kind: "competency", title: msg`Skills`, placeholder: msg`Add a skill` },
	{ kind: "software", title: msg`Software`, placeholder: msg`Add software` },
	{ kind: "tool", title: msg`Tools`, placeholder: msg`Add a tool` },
	{
		kind: "interest",
		title: msg`Interests`,
		placeholder: msg`Add an interest`,
	},
];

function nullable(value: string | undefined) {
	const trimmed = value?.trim() ?? "";
	return trimmed.length > 0 ? trimmed : null;
}

function emptyValues(fields: readonly FieldDefinition[]): FormValues {
	return Object.fromEntries(fields.map((field) => [field.key, ""]));
}

function itemToValues(item: GenericItem, fields: readonly FieldDefinition[]): FormValues {
	return Object.fromEntries(
		fields.map((field) => {
			const value = item[field.key];
			return [field.key, typeof value === "string" ? value : ""];
		}),
	);
}

function requiredFieldKey(kind: DetailedKind): string | null {
	switch (kind) {
		case "project":
		case "certification":
		case "award":
		case "reference":
		case "license":
			return "name";
		case "education":
			return "institution";
		case "volunteer":
			return "organization";
		case "language":
			return "language";
		case "course":
			return null;
	}
}

function getDetailedItems(profile: ProfileAggregate | null | undefined, kind: DetailedKind): GenericItem[] {
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

async function createDetailed(kind: DetailedKind, values: FormValues, sortOrder: number) {
	switch (kind) {
		case "project":
			return await orpc.cvmateProfile.createProject.call({
				name: nullable(values.name),
				company: nullable(values.company),
				startDate: nullable(values.startDate),
				endDate: nullable(values.endDate),
				description: nullable(values.description),
				sortOrder,
			});
		case "education":
			return await orpc.cvmateProfile.createEducation.call({
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
			return await orpc.cvmateProfile.createCourse.call({
				name: nullable(values.name),
				organizer: nullable(values.organizer),
				date: nullable(values.date),
				description: nullable(values.description),
				sortOrder,
			});
		case "certification":
			return await orpc.cvmateProfile.createCertification.call({
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
			return await orpc.cvmateProfile.createVolunteer.call({
				organization: nullable(values.organization),
				role: nullable(values.role),
				date: nullable(values.date),
				description: nullable(values.description),
				sortOrder,
			});
		case "language":
			return await orpc.cvmateProfile.createLanguage.call({
				language: nullable(values.language),
				level: nullable(values.level),
				sortOrder,
			});
		case "award":
			return await orpc.cvmateProfile.createAward.call({
				name: nullable(values.name),
				organizer: nullable(values.organizer),
				date: nullable(values.date),
				description: nullable(values.description),
				sortOrder,
			});
		case "reference":
			return await orpc.cvmateProfile.createReference.call({
				name: nullable(values.name),
				issuer: nullable(values.issuer),
				date: nullable(values.date),
				description: nullable(values.description),
				sortOrder,
			});
		case "license":
			return await orpc.cvmateProfile.createLicense.call({
				name: nullable(values.name),
				date: nullable(values.date),
				description: nullable(values.description),
				sortOrder,
			});
	}
}

async function updateDetailed(kind: DetailedKind, id: string, values: FormValues) {
	switch (kind) {
		case "project":
			return await orpc.cvmateProfile.updateProject.call({
				id,
				name: nullable(values.name),
				company: nullable(values.company),
				startDate: nullable(values.startDate),
				endDate: nullable(values.endDate),
				description: nullable(values.description),
			});
		case "education":
			return await orpc.cvmateProfile.updateEducation.call({
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
			return await orpc.cvmateProfile.updateCourse.call({
				id,
				name: nullable(values.name),
				organizer: nullable(values.organizer),
				date: nullable(values.date),
				description: nullable(values.description),
			});
		case "certification":
			return await orpc.cvmateProfile.updateCertification.call({
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
			return await orpc.cvmateProfile.updateVolunteer.call({
				id,
				organization: nullable(values.organization),
				role: nullable(values.role),
				date: nullable(values.date),
				description: nullable(values.description),
			});
		case "language":
			return await orpc.cvmateProfile.updateLanguage.call({
				id,
				language: nullable(values.language),
				level: nullable(values.level),
			});
		case "award":
			return await orpc.cvmateProfile.updateAward.call({
				id,
				name: nullable(values.name),
				organizer: nullable(values.organizer),
				date: nullable(values.date),
				description: nullable(values.description),
			});
		case "reference":
			return await orpc.cvmateProfile.updateReference.call({
				id,
				name: nullable(values.name),
				issuer: nullable(values.issuer),
				date: nullable(values.date),
				description: nullable(values.description),
			});
		case "license":
			return await orpc.cvmateProfile.updateLicense.call({
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
			return await orpc.cvmateProfile.deleteProject.call({ id });
		case "education":
			return await orpc.cvmateProfile.deleteEducation.call({ id });
		case "course":
			return await orpc.cvmateProfile.deleteCourse.call({ id });
		case "certification":
			return await orpc.cvmateProfile.deleteCertification.call({ id });
		case "volunteer":
			return await orpc.cvmateProfile.deleteVolunteer.call({ id });
		case "language":
			return await orpc.cvmateProfile.deleteLanguage.call({ id });
		case "award":
			return await orpc.cvmateProfile.deleteAward.call({ id });
		case "reference":
			return await orpc.cvmateProfile.deleteReference.call({ id });
		case "license":
			return await orpc.cvmateProfile.deleteLicense.call({ id });
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
	const { i18n } = useLingui();

	return (
		<div className="grid gap-3 md:grid-cols-2">
			{fields.map((field) => (
				<div key={field.key} className={`space-y-1 text-sm ${field.wide ? "md:col-span-2" : ""}`}>
					<span className="font-medium">{i18n.t(field.label)}</span>
					{field.multiline ? (
						<Textarea
							className="min-h-24 resize-y"
							aria-label={i18n.t(field.label)}
							placeholder={field.placeholder ? i18n.t(field.placeholder) : undefined}
							value={values[field.key] ?? ""}
							disabled={disabled}
							onChange={(event) => onChange(field.key, event.target.value)}
						/>
					) : (
						<Input
							className="w-full"
							aria-label={i18n.t(field.label)}
							type={field.type ?? "text"}
							placeholder={field.placeholder ? i18n.t(field.placeholder) : undefined}
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
	const { i18n } = useLingui();
	const profileQuery = useQuery(orpc.cvmateProfile.getCurrent.queryOptions({ input: {} }));
	const [form, setForm] = useState<FormValues>(() => emptyValues(definition.fields));
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editForm, setEditForm] = useState<FormValues>(() => emptyValues(definition.fields));

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

	const hasCreateContent = Object.values(form).some((value) => value.trim().length > 0);
	const hasEditContent = Object.values(editForm).some((value) => value.trim().length > 0);

	return (
		<section
			aria-labelledby={`master-profile-${definition.kind}`}
			className="space-y-5 rounded-card border border-border bg-card p-4 sm:p-6"
		>
			<div>
				<h2 id={`master-profile-${definition.kind}`} className="font-semibold text-foreground text-xl">
					{i18n.t(definition.title)}
				</h2>
				<p className="text-muted-foreground text-sm">{i18n.t(definition.description)}</p>
			</div>

			<form
				className="space-y-4 rounded-card border border-border bg-muted p-4"
				onSubmit={(event: FormEvent<HTMLFormElement>) => {
					event.preventDefault();
					if (hasCreateContent) createMutation.mutate();
				}}
			>
				<RecordFields
					fields={definition.fields}
					values={form}
					disabled={createMutation.isPending}
					onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))}
				/>
				<Button type="submit" className="w-fit" disabled={!hasCreateContent || createMutation.isPending}>
					{createMutation.isPending ? <Trans>Adding...</Trans> : <Trans>Add</Trans>}
				</Button>
				{createMutation.isError ? (
					<p
						role="alert"
						className="rounded-input border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm"
					>
						<Trans>Could not add this record.</Trans>
					</p>
				) : null}
			</form>

			<div className="space-y-2">
				{profileQuery.isLoading ? (
					<p role="status" className="rounded-input border border-border bg-muted p-3 text-muted-foreground text-sm">
						<Trans>Loading...</Trans>
					</p>
				) : null}
				{!profileQuery.isLoading && items.length === 0 ? (
					<p className="rounded-input border border-border bg-muted p-3 text-muted-foreground text-sm">
						<Trans>No records added yet.</Trans>
					</p>
				) : null}

				{items.map((item) => (
					<div key={item.id} className="rounded-card border border-border bg-background p-4">
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
								<div className="flex flex-wrap gap-2">
									<Button
										type="button"
										variant="outline"
										size="sm"
										disabled={!hasEditContent || updateMutation.isPending}
										onClick={() => updateMutation.mutate()}
									>
										{updateMutation.isPending ? <Trans>Saving...</Trans> : <Trans>Save</Trans>}
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										disabled={updateMutation.isPending}
										onClick={() => setEditingId(null)}
									>
										<Trans>Cancel</Trans>
									</Button>
								</div>
							</div>
						) : (
							<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
								<div className="min-w-0 space-y-1 text-sm">
									{definition.fields.map((field) => {
										const value = item[field.key];
										if (typeof value !== "string" || value.trim().length === 0) return null;

										return (
											<p key={field.key}>
												<span className="font-medium">{i18n.t(field.label)}:</span>{" "}
												<span className="whitespace-pre-wrap">{value}</span>
											</p>
										);
									})}
								</div>
								{(() => {
									const requiredKey = requiredFieldKey(definition.kind);
									if (!requiredKey) return null;

									const requiredValue = item[requiredKey];
									if (typeof requiredValue === "string" && requiredValue.trim().length > 0) {
										return null;
									}

									const requiredField = definition.fields.find((field) => field.key === requiredKey);

									return (
										<p
											role="status"
											data-testid={`cvmate-incomplete-${definition.kind}-${item.id}`}
											className="rounded-md border border-orange-200 bg-orange-50 p-2 text-orange-900 text-sm"
										>
											<Trans>Complete this record before using it in a CV.</Trans> <Trans>Required field:</Trans>{" "}
											{requiredField ? i18n.t(requiredField.label) : requiredKey}
										</p>
									);
								})()} <div className="flex flex-wrap gap-2 sm:shrink-0">
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => {
											setEditingId(item.id);
											setEditForm(itemToValues(item, definition.fields));
										}}
									>
										<Trans>Edit</Trans>
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										disabled={deleteMutation.isPending}
										onClick={() => deleteMutation.mutate(item.id)}
									>
										<Trans>Delete</Trans>
									</Button>
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
	title: MessageDescriptor;
	placeholder: MessageDescriptor;
}) {
	const { i18n } = useLingui();
	const profileQuery = useQuery(orpc.cvmateProfile.getCurrent.queryOptions({ input: {} }));
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
		<section
			aria-labelledby={`master-profile-${kind}`}
			className="space-y-5 rounded-card border border-border bg-card p-4 sm:p-6"
		>
			<h2 id={`master-profile-${kind}`} className="font-semibold text-foreground text-xl">
				{i18n.t(title)}
			</h2>
			<form
				className="flex flex-wrap gap-2"
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
				<Input
					className="min-w-0 flex-1"
					aria-label={i18n.t(placeholder)}
					placeholder={i18n.t(placeholder)}
					value={value}
					disabled={createMutation.isPending}
					onChange={(event) => setValue(event.target.value)}
				/>
				<Button type="submit" className="shrink-0" disabled={!value.trim() || createMutation.isPending}>
					<Trans>Add</Trans>
				</Button>
			</form>

			<div className="flex flex-wrap gap-2">
				{items.map((item) =>
					editingId === item.id ? (
						<form
							key={item.id}
							className="flex flex-wrap gap-2"
							onSubmit={(event) => {
								event.preventDefault();
								const trimmed = editValue.trim();
								if (!trimmed) return;
								updateMutation.mutate({ id: item.id, value: trimmed });
							}}
						>
							<Input
								className="w-full"
								aria-label={i18n.t(title)}
								value={editValue}
								onChange={(event) => setEditValue(event.target.value)}
							/>
							<Button type="submit" variant="outline" size="sm">
								<Trans>Save</Trans>
							</Button>
							<Button type="button" variant="outline" size="sm" onClick={() => setEditingId(null)}>
								<Trans>Cancel</Trans>
							</Button>
						</form>
					) : (
						<div
							key={item.id}
							className="flex items-center gap-1 rounded-input border border-border bg-muted px-2 py-1 text-sm"
						>
							<span>{item.value}</span>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="text-muted-foreground hover:text-foreground"
								onClick={() => {
									setEditingId(item.id);
									setEditValue(item.value);
								}}
							>
								<Trans>Edit</Trans>
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="text-muted-foreground hover:text-destructive"
								disabled={deleteMutation.isPending}
								onClick={() => deleteMutation.mutate({ id: item.id })}
							>
								<Trans>Delete</Trans>
							</Button>
						</div>
					),
				)}
			</div>
			{!profileQuery.isLoading && items.length === 0 ? (
				<p className="rounded-input border border-border bg-muted p-3 text-muted-foreground text-sm">
					<Trans>Nothing added yet.</Trans>
				</p>
			) : null}
		</section>
	);
}

type ClauseScope = RecruitmentClauseScope;
type ClauseLanguage = RecruitmentClauseLanguage;
type ClauseKey = `${ClauseScope}:${ClauseLanguage}`;

type ClauseDraft = {
	content: string;
	isDefault: boolean;
};

const clauseScopeDefinitions: readonly {
	scope: ClauseScope;
	title: MessageDescriptor;
}[] = [
	{
		scope: "current",
		title: msg`Current recruitment only`,
	},
	{
		scope: "current_and_future",
		title: msg`Current and future recruitment processes`,
	},
];

const clauseLanguageDefinitions: readonly {
	language: ClauseLanguage;
	title: MessageDescriptor;
}[] = [
	{
		language: "pl",
		title: msg`Polish version`,
	},
	{
		language: "en",
		title: msg`English version`,
	},
];

function clauseKey(scope: ClauseScope, language: ClauseLanguage): ClauseKey {
	return `${scope}:${language}`;
}

function emptyClauseDrafts(): Record<ClauseKey, ClauseDraft> {
	return {
		"current:pl": {
			content: getDefaultRecruitmentClause("current", "pl"),
			isDefault: true,
		},
		"current:en": {
			content: getDefaultRecruitmentClause("current", "en"),
			isDefault: true,
		},
		"current_and_future:pl": {
			content: getDefaultRecruitmentClause("current_and_future", "pl"),
			isDefault: true,
		},
		"current_and_future:en": {
			content: getDefaultRecruitmentClause("current_and_future", "en"),
			isDefault: true,
		},
	};
}

function ClausesSection() {
	const { i18n } = useLingui();
	const profileQuery = useQuery(orpc.cvmateProfile.getCurrent.queryOptions({ input: {} }));
	const [drafts, setDrafts] = useState<Record<ClauseKey, ClauseDraft>>(emptyClauseDrafts);

	useEffect(() => {
		const next = emptyClauseDrafts();

		for (const clause of profileQuery.data?.clauses ?? []) {
			const key = clauseKey(clause.scope, clause.language);
			next[key] = {
				content: clause.content ?? getDefaultRecruitmentClause(clause.scope, clause.language),
				isDefault: clause.content === null,
			};
		}

		setDrafts(next);
	}, [profileQuery.data?.clauses]);

	const selectedScope =
		clauseScopeDefinitions.find((definition) =>
			(profileQuery.data?.clauses ?? []).some((clause) => clause.scope === definition.scope && clause.isEnabled),
		)?.scope ?? null;

	const selectionMutation = useMutation({
		mutationFn: async (nextScope: ClauseScope | null) => {
			const allScopes = clauseScopeDefinitions.map((definition) => definition.scope);

			const orderedScopes =
				nextScope === null ? allScopes : [...allScopes.filter((scope) => scope !== nextScope), nextScope];

			for (const scope of orderedScopes) {
				for (const definition of clauseLanguageDefinitions) {
					await orpc.cvmateProfile.upsertClause.call({
						scope,
						language: definition.language,
						isEnabled: nextScope === scope,
					});
				}
			}
		},
		onSuccess: () => void profileQuery.refetch(),
	});

	const saveMutation = useMutation({
		mutationFn: ({ scope, language }: { scope: ClauseScope; language: ClauseLanguage }) => {
			const draft = drafts[clauseKey(scope, language)];

			return orpc.cvmateProfile.upsertClause.call({
				scope,
				language,
				isEnabled: selectedScope === scope,
				content: draft.isDefault ? null : draft.content.trim() || null,
			});
		},
		onSuccess: () => void profileQuery.refetch(),
	});

	const restoreMutation = useMutation({
		mutationFn: ({ scope, language }: { scope: ClauseScope; language: ClauseLanguage }) =>
			orpc.cvmateProfile.upsertClause.call({
				scope,
				language,
				isEnabled: selectedScope === scope,
				content: null,
			}),
		onSuccess: () => void profileQuery.refetch(),
	});

	const mutationPending = selectionMutation.isPending || saveMutation.isPending || restoreMutation.isPending;

	return (
		<section
			aria-labelledby="master-profile-recruitment-clauses"
			className="space-y-5 rounded-card border border-border bg-card p-4 sm:p-6"
		>
			<div>
				<h2 id="master-profile-recruitment-clauses" className="font-semibold text-foreground text-xl">
					<Trans>Recruitment clauses</Trans>
				</h2>
				<p className="text-muted-foreground text-sm">
					<Trans>
						Choose one recruitment clause. 1story will automatically use the Polish or English version based on the CV
						language.
					</Trans>
				</p>
			</div>

			<div className="space-y-2 rounded-card border border-border bg-muted p-4">
				<label className="flex items-center gap-2 text-base">
					<input
						type="radio"
						className="size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
						name="recruitment-clause-scope"
						checked={selectedScope === null}
						disabled={mutationPending}
						onChange={() => selectionMutation.mutate(null)}
					/>
					<Trans>Do not add a recruitment clause</Trans>
				</label>
			</div>

			<div className="space-y-4">
				{clauseScopeDefinitions.map((scopeDefinition) => (
					<div key={scopeDefinition.scope} className="space-y-4 rounded-card border border-border bg-background p-4">
						<label className="flex items-center gap-2 font-medium text-base">
							<input
								type="radio"
								className="size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
								name="recruitment-clause-scope"
								checked={selectedScope === scopeDefinition.scope}
								disabled={mutationPending}
								onChange={() => selectionMutation.mutate(scopeDefinition.scope)}
							/>
							{i18n.t(scopeDefinition.title)}
						</label>

						<div className="grid gap-4 lg:grid-cols-2">
							{clauseLanguageDefinitions.map((languageDefinition) => {
								const key = clauseKey(scopeDefinition.scope, languageDefinition.language);
								const draft = drafts[key];

								return (
									<div key={key} className="space-y-3">
										<div className="flex items-center justify-between gap-3">
											<p className="font-medium text-sm">{i18n.t(languageDefinition.title)}</p>
											<p className="text-muted-foreground text-sm">
												{draft.isDefault ? <Trans>1story default</Trans> : <Trans>Custom text</Trans>}
											</p>
										</div>

										<Textarea
											className="min-h-24 resize-y"
											aria-label={i18n.t(languageDefinition.title)}
											value={draft.content}
											onChange={(event) =>
												setDrafts((current) => ({
													...current,
													[key]: {
														content: event.target.value,
														isDefault: false,
													},
												}))
											}
										/>

										<div className="flex flex-wrap gap-2">
											<Button
												type="button"
												variant="outline"
												size="sm"
												disabled={mutationPending}
												onClick={() =>
													saveMutation.mutate({
														scope: scopeDefinition.scope,
														language: languageDefinition.language,
													})
												}
											>
												{saveMutation.isPending ? <Trans>Saving...</Trans> : <Trans>Save clause</Trans>}
											</Button>

											<Button
												type="button"
												variant="outline"
												size="sm"
												disabled={mutationPending || draft.isDefault}
												onClick={() =>
													restoreMutation.mutate({
														scope: scopeDefinition.scope,
														language: languageDefinition.language,
													})
												}
											>
												<Trans>Restore default</Trans>
											</Button>
										</div>
									</div>
								);
							})}
						</div>
					</div>
				))}
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
				<DetailedSection key={definition.kind} definition={definition} />
			))}

			<ClausesSection />
		</div>
	);
}
