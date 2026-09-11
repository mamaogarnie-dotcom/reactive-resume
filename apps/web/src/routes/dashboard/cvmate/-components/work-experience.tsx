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
				<h2 className="text-lg font-semibold">Work experience</h2>
				<p className="text-sm text-muted-foreground">
					Add roles that can later be used to create tailored resumes.
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
						placeholder="Company"
						value={company}
						onChange={(event) => setCompany(event.target.value)}
					/>
					<input
						className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
						placeholder="Job title"
						value={jobTitle}
						onChange={(event) => setJobTitle(event.target.value)}
					/>
					<input
						className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
						placeholder="Location"
						value={location}
						onChange={(event) => setLocation(event.target.value)}
					/>
					<input
						className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
						placeholder="Start date: YYYY, YYYY-MM or YYYY-MM-DD"
						value={startDate}
						onChange={(event) => setStartDate(event.target.value)}
					/>
					<input
						className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
						placeholder="End date: YYYY, YYYY-MM or YYYY-MM-DD"
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
					I currently work here
				</label>

				<button
					type="submit"
					className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
					disabled={!canCreate || createEmployment.isPending}
				>
					{createEmployment.isPending ? "Adding..." : "Add employment"}
				</button>
			</form>

			{createEmployment.isError ? (
				<p className="text-sm text-destructive">Could not add employment.</p>
			) : null}

			<div className="space-y-3">
				{profileQuery.isLoading ? (
					<p className="text-sm text-muted-foreground">Loading experience...</p>
				) : null}

				{!profileQuery.isLoading && employments.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						No work experience has been added yet.
					</p>
				) : null}

				{employments.map((employment) => (
					<div key={employment.id} className="rounded-md border p-3">
						{editingId === employment.id ? (
							<div className="space-y-3">
								<div className="grid gap-3 md:grid-cols-2">
									<input
										className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
										placeholder="Company"
										value={editCompany}
										onChange={(event) => setEditCompany(event.target.value)}
									/>
									<input
										className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
										placeholder="Job title"
										value={editJobTitle}
										onChange={(event) => setEditJobTitle(event.target.value)}
									/>
									<input
										className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
										placeholder="Location"
										value={editLocation}
										onChange={(event) => setEditLocation(event.target.value)}
									/>
									<input
										className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
										placeholder="Start date: YYYY, YYYY-MM or YYYY-MM-DD"
										value={editStartDate}
										onChange={(event) => setEditStartDate(event.target.value)}
									/>
									<input
										className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
										placeholder="End date: YYYY, YYYY-MM or YYYY-MM-DD"
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
									I currently work here
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
										{updateEmployment.isPending ? "Saving..." : "Save"}
									</button>
									<button
										type="button"
										className="rounded-md border px-3 py-1.5 text-sm"
										disabled={updateEmployment.isPending}
										onClick={() => setEditingId(null)}
									>
										Cancel
									</button>
								</div>
							</div>
						) : (
							<div className="flex items-start justify-between gap-4">
								<div className="min-w-0 space-y-1">
									<p className="font-medium">
										{employment.jobTitle || employment.company || "Employment"}
									</p>
									{employment.jobTitle && employment.company ? (
										<p className="text-sm text-muted-foreground">
											{employment.company}
										</p>
									) : null}
									<p className="text-sm text-muted-foreground">
										{employment.startDate || "?"} Ä‚ËĂ˘â€šÂ¬Ă˘â‚¬Ĺ›{" "}
										{employment.isCurrent
											? "Present"
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
										Edit
									</button>
									<button
										type="button"
										className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
										disabled={deleteEmployment.isPending}
										onClick={() =>
											deleteEmployment.mutate({ id: employment.id })
										}
									>
										Delete
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
													{updateExperienceFact.isPending
														? "Saving..."
														: "Save"}
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
													Cancel
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
													Up
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
													Down
												</button>
												<button
													type="button"
													className="shrink-0 rounded-md border px-2 py-1 text-xs"
													onClick={() => {
														setEditingFactId(fact.id);
														setEditFactText(fact.text);
													}}
												>
													Edit
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
													{" "}
													Remove{" "}
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
								placeholder="Responsibility or achievement"
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
								createAndLinkFact.variables?.employmentId === employment.id
									? "Adding..."
									: "Add fact"}
							</button>
						</form>
					</div>
				))}

				{createAndLinkFact.isError ? (
					<p className="text-sm text-destructive">
						Could not add the experience fact.
					</p>
				) : null}
				{updateEmployment.isError ? (
					<p className="text-sm text-destructive">
						Could not update employment.
					</p>
				) : null}
				{deleteEmployment.isError ? (
					<p className="text-sm text-destructive">
						Could not delete employment.
					</p>
				) : null}
			</div>
		</section>
	);
}
