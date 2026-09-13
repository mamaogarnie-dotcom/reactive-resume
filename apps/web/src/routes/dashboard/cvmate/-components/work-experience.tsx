import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { orpc } from "@/libs/orpc/client";

export function WorkExperienceSection() {
	const [company, setCompany] = useState("");
	const [jobTitle, setJobTitle] = useState("");
	const [location, setLocation] = useState("");
	const [startDate, setStartDate] = useState("");
	const [endDate, setEndDate] = useState("");
	const [isCurrent, setIsCurrent] = useState(false);

	const [editingId, setEditingId] = useState<string | null>(null);
	const [editCompany, setEditCompany] = useState("");
	const [editJobTitle, setEditJobTitle] = useState("");
	const [editLocation, setEditLocation] = useState("");
	const [editStartDate, setEditStartDate] = useState("");
	const [editEndDate, setEditEndDate] = useState("");
	const [editIsCurrent, setEditIsCurrent] = useState(false);
	const [editingFactId, setEditingFactId] = useState<string | null>(null);
	const [editFactText, setEditFactText] = useState("");
	const [factTextByEmployment, setFactTextByEmployment] = useState<
		Record<string, string>
	>({});

	const profileQuery = useQuery(
		orpc.cvmateProfile.getCurrent.queryOptions({ input: {} }),
	);

	const employments = [...(profileQuery.data?.employments ?? [])].sort(
		(a, b) => a.sortOrder - b.sortOrder,
	);
	const employmentFacts = profileQuery.data?.employmentFacts ?? [];
	const experienceFacts = profileQuery.data?.experienceFacts ?? [];

	const createEmployment = useMutation(
		orpc.cvmateProfile.createEmployment.mutationOptions({
			onSuccess: () => {
				setCompany("");
				setJobTitle("");
				setLocation("");
				setStartDate("");
				setEndDate("");
				setIsCurrent(false);
				void profileQuery.refetch();
			},
		}),
	);

	const updateEmployment = useMutation(
		orpc.cvmateProfile.updateEmployment.mutationOptions({
			onSuccess: () => {
				setEditingId(null);
				setEditCompany("");
				setEditJobTitle("");
				setEditLocation("");
				setEditStartDate("");
				setEditEndDate("");
				setEditIsCurrent(false);
				void profileQuery.refetch();
			},
		}),
	);

	const deleteEmployment = useMutation(
		orpc.cvmateProfile.deleteEmployment.mutationOptions({
			onSuccess: () => void profileQuery.refetch(),
		}),
	);

	const createAndLinkFact = useMutation({
		mutationFn: async (input: {
			employmentId: string;
			text: string;
			sortOrder: number;
		}) => {
			const fact = await orpc.cvmateProfile.createExperienceFact.call({
				text: input.text,
			});

			try {
				await orpc.cvmateProfile.linkEmploymentFact.call({
					employmentId: input.employmentId,
					experienceFactId: fact.id,
					sortOrder: input.sortOrder,
				});
			} catch (error) {
				await orpc.cvmateProfile.deleteExperienceFact
					.call({ id: fact.id })
					.catch(() => undefined);
				throw error;
			}

			return fact;
		},
		onSuccess: (_fact, input) => {
			setFactTextByEmployment((current) => ({
				...current,
				[input.employmentId]: "",
			}));
			void profileQuery.refetch();
		},
	});

	const updateExperienceFact = useMutation(
		orpc.cvmateProfile.updateExperienceFact.mutationOptions({
			onSuccess: () => {
				setEditingFactId(null);
				setEditFactText("");
				void profileQuery.refetch();
			},
		}),
	);

	const unlinkEmploymentFact = useMutation(
		orpc.cvmateProfile.unlinkEmploymentFact.mutationOptions({
			onSuccess: () => void profileQuery.refetch(),
		}),
	);

	const reorderEmploymentFact = useMutation({
		mutationFn: async (input: {
			employmentId: string;
			firstExperienceFactId: string;
			firstSortOrder: number;
			secondExperienceFactId: string;
			secondSortOrder: number;
		}) => {
			await orpc.cvmateProfile.linkEmploymentFact.call({
				employmentId: input.employmentId,
				experienceFactId: input.firstExperienceFactId,
				sortOrder: input.firstSortOrder,
			});

			try {
				await orpc.cvmateProfile.linkEmploymentFact.call({
					employmentId: input.employmentId,
					experienceFactId: input.secondExperienceFactId,
					sortOrder: input.secondSortOrder,
				});
			} catch (error) {
				await orpc.cvmateProfile.linkEmploymentFact
					.call({
						employmentId: input.employmentId,
						experienceFactId: input.firstExperienceFactId,
						sortOrder: input.secondSortOrder,
					})
					.catch(() => undefined);
				throw error;
			}
		},
		onSuccess: () => void profileQuery.refetch(),
	});

	const canCreate = [company, jobTitle, location, startDate, endDate].some(
		(value) => value.trim().length > 0,
	);

	const canUpdate = [
		editCompany,
		editJobTitle,
		editLocation,
		editStartDate,
		editEndDate,
	].some((value) => value.trim().length > 0);

	return (
		<section className="space-y-4">
			<div>
				<h2 className="text-lg font-semibold">
					<Trans>Work experience</Trans>
				</h2>
				<p className="text-sm text-muted-foreground">
					<Trans>
						Add roles that can later be used to create tailored resumes.
					</Trans>
				</p>
			</div>

			<form
				className="space-y-3"
				onSubmit={(event) => {
					event.preventDefault();
					if (!canCreate) return;

					createEmployment.mutate({
						company: company.trim() || null,
						jobTitle: jobTitle.trim() || null,
						location: location.trim() || null,
						startDate: startDate.trim() || null,
						endDate: isCurrent ? null : endDate.trim() || null,
						isCurrent,
						sortOrder: employments.length,
					});
				}}
			>
				<div className="grid gap-3 md:grid-cols-2">
					<input
						className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
						placeholder={t`Company`}
						value={company}
						onChange={(event) => setCompany(event.target.value)}
					/>
					<input
						className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
						placeholder={t`Job title`}
						value={jobTitle}
						onChange={(event) => setJobTitle(event.target.value)}
					/>
					<input
						className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
						placeholder={t`Location`}
						value={location}
						onChange={(event) => setLocation(event.target.value)}
					/>
					<input
						className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
						placeholder={t`Start date: YYYY, YYYY-MM or YYYY-MM-DD`}
						value={startDate}
						onChange={(event) => setStartDate(event.target.value)}
					/>
					<input
						className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
						placeholder={t`End date: YYYY, YYYY-MM or YYYY-MM-DD`}
						value={endDate}
						disabled={isCurrent}
						onChange={(event) => setEndDate(event.target.value)}
					/>
				</div>

				<label className="flex items-center gap-2 text-sm">
					<input
						type="checkbox"
						checked={isCurrent}
						onChange={(event) => {
							setIsCurrent(event.target.checked);
							if (event.target.checked) setEndDate("");
						}}
					/>
					<Trans>I currently work here</Trans>
				</label>

				<button
					type="submit"
					className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
					disabled={!canCreate || createEmployment.isPending}
				>
					{createEmployment.isPending ? (
						<Trans>Adding...</Trans>
					) : (
						<Trans>Add employment</Trans>
					)}
				</button>
			</form>

			{createEmployment.isError ? (
				<p className="text-sm text-destructive">
					<Trans>Could not add employment.</Trans>
				</p>
			) : null}

			<div className="space-y-3">
				{profileQuery.isLoading ? (
					<p className="text-sm text-muted-foreground">
						<Trans>Loading experience...</Trans>
					</p>
				) : null}

				{!profileQuery.isLoading && employments.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						<Trans>No work experience has been added yet.</Trans>
					</p>
				) : null}

				{employments.map((employment) => (
					<div key={employment.id} className="rounded-md border p-3">
						{editingId === employment.id ? (
							<div className="space-y-3">
								<div className="grid gap-3 md:grid-cols-2">
									<input
										className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
										placeholder={t`Company`}
										value={editCompany}
										onChange={(event) => setEditCompany(event.target.value)}
									/>
									<input
										className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
										placeholder={t`Job title`}
										value={editJobTitle}
										onChange={(event) => setEditJobTitle(event.target.value)}
									/>
									<input
										className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
										placeholder={t`Location`}
										value={editLocation}
										onChange={(event) => setEditLocation(event.target.value)}
									/>
									<input
										className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
										placeholder={t`Start date: YYYY, YYYY-MM or YYYY-MM-DD`}
										value={editStartDate}
										onChange={(event) => setEditStartDate(event.target.value)}
									/>
									<input
										className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
										placeholder={t`End date: YYYY, YYYY-MM or YYYY-MM-DD`}
										value={editEndDate}
										disabled={editIsCurrent}
										onChange={(event) => setEditEndDate(event.target.value)}
									/>
								</div>

								<label className="flex items-center gap-2 text-sm">
									<input
										type="checkbox"
										checked={editIsCurrent}
										onChange={(event) => {
											setEditIsCurrent(event.target.checked);
											if (event.target.checked) setEditEndDate("");
										}}
									/>
									<Trans>I currently work here</Trans>
								</label>

								<div className="flex gap-2">
									<button
										type="button"
										className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
										disabled={!canUpdate || updateEmployment.isPending}
										onClick={() =>
											updateEmployment.mutate({
												id: employment.id,
												company: editCompany.trim() || null,
												jobTitle: editJobTitle.trim() || null,
												location: editLocation.trim() || null,
												startDate: editStartDate.trim() || null,
												endDate: editIsCurrent
													? null
													: editEndDate.trim() || null,
												isCurrent: editIsCurrent,
											})
										}
									>
										{updateEmployment.isPending ? (
											<Trans>Saving...</Trans>
										) : (
											<Trans>Save</Trans>
										)}
									</button>
									<button
										type="button"
										className="rounded-md border px-3 py-1.5 text-sm"
										disabled={updateEmployment.isPending}
										onClick={() => setEditingId(null)}
									>
										<Trans>Cancel</Trans>
									</button>
								</div>
							</div>
						) : (
							<div className="flex items-start justify-between gap-4">
								<div className="min-w-0 space-y-1">
									<p className="font-medium">
										{employment.jobTitle || employment.company || t`Employment`}
									</p>
									{employment.jobTitle && employment.company ? (
										<p className="text-sm text-muted-foreground">
											{employment.company}
										</p>
									) : null}
									<p className="text-sm text-muted-foreground">
										{employment.startDate || "?"} {" – "}
										{employment.isCurrent
											? t`Present`
											: employment.endDate || "?"}
									</p>
									{employment.location ? (
										<p className="text-sm text-muted-foreground">
											{employment.location}
										</p>
									) : null}
								</div>

								<div className="flex shrink-0 gap-2">
									<button
										type="button"
										className="rounded-md border px-3 py-1.5 text-sm"
										onClick={() => {
											setEditingId(employment.id);
											setEditCompany(employment.company ?? "");
											setEditJobTitle(employment.jobTitle ?? "");
											setEditLocation(employment.location ?? "");
											setEditStartDate(employment.startDate ?? "");
											setEditEndDate(employment.endDate ?? "");
											setEditIsCurrent(employment.isCurrent);
										}}
									>
										<Trans>Edit</Trans>
									</button>
									<button
										type="button"
										className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
										disabled={deleteEmployment.isPending}
										onClick={() =>
											deleteEmployment.mutate({ id: employment.id })
										}
									>
										<Trans>Delete</Trans>
									</button>
								</div>
							</div>
						)}

						{employmentFacts
							.filter((link) => link.employmentId === employment.id)
							.sort((a, b) => a.sortOrder - b.sortOrder)
							.map((link, index, links) => {
								const fact = experienceFacts.find(
									(item) => item.id === link.experienceFactId,
								);
								if (!fact) return null;

								return (
									<div
										key={link.experienceFactId}
										className="mt-3 rounded-md bg-muted/40 px-3 py-2"
									>
										{editingFactId === fact.id ? (
											<div className="flex gap-2">
												<input
													className="h-9 min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 text-sm"
													value={editFactText}
													onChange={(event) =>
														setEditFactText(event.target.value)
													}
												/>
												<button
													type="button"
													className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
													disabled={
														!editFactText.trim() ||
														updateExperienceFact.isPending
													}
													onClick={() =>
														updateExperienceFact.mutate({
															id: fact.id,
															text: editFactText.trim(),
														})
													}
												>
													{updateExperienceFact.isPending ? (
														<Trans>Saving...</Trans>
													) : (
														<Trans>Save</Trans>
													)}
												</button>
												<button
													type="button"
													className="rounded-md border px-3 py-1.5 text-sm"
													disabled={updateExperienceFact.isPending}
													onClick={() => {
														setEditingFactId(null);
														setEditFactText("");
													}}
												>
													<Trans>Cancel</Trans>
												</button>
											</div>
										) : (
											<div className="flex items-start justify-between gap-3">
												<p className="text-sm">{fact.text}</p>
												<button
													type="button"
													className="shrink-0 rounded-md border px-2 py-1 text-xs disabled:opacity-50"
													disabled={
														index === 0 || reorderEmploymentFact.isPending
													}
													onClick={() => {
														const previous = links[index - 1];
														if (!previous) return;

														reorderEmploymentFact.mutate({
															employmentId: employment.id,
															firstExperienceFactId: link.experienceFactId,
															firstSortOrder: previous.sortOrder,
															secondExperienceFactId: previous.experienceFactId,
															secondSortOrder: link.sortOrder,
														});
													}}
												>
													<Trans>Up</Trans>
												</button>
												<button
													type="button"
													className="shrink-0 rounded-md border px-2 py-1 text-xs disabled:opacity-50"
													disabled={
														index === links.length - 1 ||
														reorderEmploymentFact.isPending
													}
													onClick={() => {
														const next = links[index + 1];
														if (!next) return;

														reorderEmploymentFact.mutate({
															employmentId: employment.id,
															firstExperienceFactId: link.experienceFactId,
															firstSortOrder: next.sortOrder,
															secondExperienceFactId: next.experienceFactId,
															secondSortOrder: link.sortOrder,
														});
													}}
												>
													<Trans>Down</Trans>
												</button>
												<button
													type="button"
													className="shrink-0 rounded-md border px-2 py-1 text-xs"
													onClick={() => {
														setEditingFactId(fact.id);
														setEditFactText(fact.text);
													}}
												>
													<Trans>Edit</Trans>
												</button>
												<button
													type="button"
													className="shrink-0 rounded-md border px-2 py-1 text-xs disabled:opacity-50"
													disabled={unlinkEmploymentFact.isPending}
													onClick={() =>
														unlinkEmploymentFact.mutate({
															employmentId: employment.id,
															experienceFactId: fact.id,
														})
													}
												>
													<Trans>Remove</Trans>
												</button>
											</div>
										)}
									</div>
								);
							})}

						<form
							className="mt-3 flex gap-2 border-t pt-3"
							onSubmit={(event) => {
								event.preventDefault();

								const text = (factTextByEmployment[employment.id] ?? "").trim();
								if (!text) return;

								const sortOrder =
									employmentFacts
										.filter((link) => link.employmentId === employment.id)
										.reduce((max, link) => Math.max(max, link.sortOrder), -1) +
									1;

								createAndLinkFact.mutate({
									employmentId: employment.id,
									text,
									sortOrder,
								});
							}}
						>
							<input
								className="h-9 min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 text-sm"
								placeholder={t`Responsibility or achievement`}
								value={factTextByEmployment[employment.id] ?? ""}
								onChange={(event) =>
									setFactTextByEmployment((current) => ({
										...current,
										[employment.id]: event.target.value,
									}))
								}
							/>
							<button
								type="submit"
								className="shrink-0 rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
								disabled={
									!(factTextByEmployment[employment.id] ?? "").trim() ||
									createAndLinkFact.isPending
								}
							>
								{createAndLinkFact.isPending &&
								createAndLinkFact.variables?.employmentId === employment.id ? (
									<Trans>Adding...</Trans>
								) : (
									<Trans>Add fact</Trans>
								)}
							</button>
						</form>
					</div>
				))}

				{createAndLinkFact.isError ? (
					<p className="text-sm text-destructive">
						<Trans>Could not add the experience fact.</Trans>
					</p>
				) : null}
				{updateEmployment.isError ? (
					<p className="text-sm text-destructive">
						<Trans>Could not update employment.</Trans>
					</p>
				) : null}
				{deleteEmployment.isError ? (
					<p className="text-sm text-destructive">
						<Trans>Could not delete employment.</Trans>
					</p>
				) : null}
			</div>
		</section>
	);
}
