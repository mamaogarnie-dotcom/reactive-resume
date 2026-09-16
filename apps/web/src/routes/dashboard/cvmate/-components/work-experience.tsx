import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Button } from "@reactive-resume/ui/components/button";
import { Input } from "@reactive-resume/ui/components/input";
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
				kind: "responsibility",
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
		<section
aria-labelledby="master-profile-work-experience"
className="space-y-5 rounded-card border border-border bg-card p-4 sm:p-6"
>
			<div>
				<h2 id="master-profile-work-experience" className="text-xl font-semibold text-foreground">
					<Trans>Work experience</Trans>
				</h2>
				<p className="text-sm text-muted-foreground">
					<Trans>
						Add roles that can later be used to create tailored resumes.
					</Trans>
				</p>
			</div>

			<form
				className="space-y-4 rounded-card border border-border bg-muted p-4"
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
					<Input
						className="w-full"
						aria-label={t`Company`} placeholder={t`Company`}
						value={company}
						onChange={(event) => setCompany(event.target.value)}
					/>
					<Input
						className="w-full"
						aria-label={t`Job title`} placeholder={t`Job title`}
						value={jobTitle}
						onChange={(event) => setJobTitle(event.target.value)}
					/>
					<Input
						className="w-full"
						aria-label={t`Location`} placeholder={t`Location`}
						value={location}
						onChange={(event) => setLocation(event.target.value)}
					/>
					<Input
						className="w-full"
						aria-label={t`Start date: YYYY, YYYY-MM or YYYY-MM-DD`} placeholder={t`Start date: YYYY, YYYY-MM or YYYY-MM-DD`}
						value={startDate}
						onChange={(event) => setStartDate(event.target.value)}
					/>
					<Input
						className="w-full"
						aria-label={t`End date: YYYY, YYYY-MM or YYYY-MM-DD`} placeholder={t`End date: YYYY, YYYY-MM or YYYY-MM-DD`}
						value={endDate}
						disabled={isCurrent}
						onChange={(event) => setEndDate(event.target.value)}
					/>
				</div>

				<label className="flex items-center gap-2 text-base">
					<input
						type="checkbox" className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
						checked={isCurrent}
						onChange={(event) => {
							setIsCurrent(event.target.checked);
							if (event.target.checked) setEndDate("");
						}}
					/>
					<Trans>I currently work here</Trans>
				</label>

				<Button
					type="submit"
					className="w-fit"
					disabled={!canCreate || createEmployment.isPending}
				>
					{createEmployment.isPending ? (
						<Trans>Adding...</Trans>
					) : (
						<Trans>Add employment</Trans>
					)}
				</Button>
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
					<div key={employment.id} className="rounded-card border border-border bg-background p-4">
						{editingId === employment.id ? (
							<div className="space-y-3">
								<div className="grid gap-3 md:grid-cols-2">
									<Input
										className="w-full"
										aria-label={t`Company`} placeholder={t`Company`}
										value={editCompany}
										onChange={(event) => setEditCompany(event.target.value)}
									/>
									<Input
										className="w-full"
										aria-label={t`Job title`} placeholder={t`Job title`}
										value={editJobTitle}
										onChange={(event) => setEditJobTitle(event.target.value)}
									/>
									<Input
										className="w-full"
										aria-label={t`Location`} placeholder={t`Location`}
										value={editLocation}
										onChange={(event) => setEditLocation(event.target.value)}
									/>
									<Input
										className="w-full"
										aria-label={t`Start date: YYYY, YYYY-MM or YYYY-MM-DD`} placeholder={t`Start date: YYYY, YYYY-MM or YYYY-MM-DD`}
										value={editStartDate}
										onChange={(event) => setEditStartDate(event.target.value)}
									/>
									<Input
										className="w-full"
										aria-label={t`End date: YYYY, YYYY-MM or YYYY-MM-DD`} placeholder={t`End date: YYYY, YYYY-MM or YYYY-MM-DD`}
										value={editEndDate}
										disabled={editIsCurrent}
										onChange={(event) => setEditEndDate(event.target.value)}
									/>
								</div>

								<label className="flex items-center gap-2 text-base">
									<input
										type="checkbox" className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
										checked={editIsCurrent}
										onChange={(event) => {
											setEditIsCurrent(event.target.checked);
											if (event.target.checked) setEditEndDate("");
										}}
									/>
									<Trans>I currently work here</Trans>
								</label>

								<div className="flex flex-wrap gap-2">
									<Button
										type="button"
										variant="outline" size="sm"
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
									</Button>
									<Button
										type="button"
										variant="outline" size="sm"
										disabled={updateEmployment.isPending}
										onClick={() => setEditingId(null)}
									>
										<Trans>Cancel</Trans>
									</Button>
								</div>
							</div>
						) : (
							<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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

								<div className="flex flex-wrap gap-2 sm:shrink-0">
									<Button
										type="button"
										variant="outline" size="sm"
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
									</Button>
									<Button
										type="button"
										variant="outline" size="sm"
										disabled={deleteEmployment.isPending}
										onClick={() =>
											deleteEmployment.mutate({ id: employment.id })
										}
									>
										<Trans>Delete</Trans>
									</Button>
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
										className="mt-3 rounded-input bg-muted px-3 py-2"
									>
										{editingFactId === fact.id ? (
											<div className="flex flex-wrap gap-2">
												<Input
													className="min-w-0 flex-1"
													aria-label={t`Responsibility`} value={editFactText}
													onChange={(event) =>
														setEditFactText(event.target.value)
													}
												/>
												<Button
													type="button"
													variant="outline" size="sm"
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
												</Button>
												<Button
													type="button"
													variant="outline" size="sm"
													disabled={updateExperienceFact.isPending}
													onClick={() => {
														setEditingFactId(null);
														setEditFactText("");
													}}
												>
													<Trans>Cancel</Trans>
												</Button>
											</div>
										) : (
											<div className="flex flex-wrap items-start gap-2">
												<p className="min-w-0 flex-1 text-sm">{fact.text}</p>
												<Button
													type="button"
													variant="outline" size="sm" className="shrink-0"
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
												</Button>
												<Button
													type="button"
													variant="outline" size="sm" className="shrink-0"
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
												</Button>
												<Button
													type="button"
													variant="outline" size="sm" className="shrink-0"
													onClick={() => {
														setEditingFactId(fact.id);
														setEditFactText(fact.text);
													}}
												>
													<Trans>Edit</Trans>
												</Button>
												<Button
													type="button"
													variant="outline" size="sm" className="shrink-0"
													disabled={unlinkEmploymentFact.isPending}
													onClick={() =>
														unlinkEmploymentFact.mutate({
															employmentId: employment.id,
															experienceFactId: fact.id,
														})
													}
												>
													<Trans>Remove</Trans>
												</Button>
											</div>
										)}
									</div>
								);
							})}

						<form
							className="mt-3 flex flex-col gap-2 border-t pt-3 sm:flex-row"
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
							<Input
								className="min-w-0 flex-1"
								aria-label={t`Responsibility`} placeholder={t`Responsibility`}
								value={factTextByEmployment[employment.id] ?? ""}
								onChange={(event) =>
									setFactTextByEmployment((current) => ({
										...current,
										[employment.id]: event.target.value,
									}))
								}
							/>
							<Button
								type="submit"
								variant="outline" size="sm" className="shrink-0"
								disabled={
									!(factTextByEmployment[employment.id] ?? "").trim() ||
									createAndLinkFact.isPending
								}
							>
								{createAndLinkFact.isPending &&
								createAndLinkFact.variables?.employmentId === employment.id ? (
									<Trans>Adding...</Trans>
								) : (
									<Trans>Add responsibility</Trans>
								)}
							</Button>
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
