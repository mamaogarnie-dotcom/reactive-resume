import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@reactive-resume/ui/components/button";
import { Input } from "@reactive-resume/ui/components/input";
import { Textarea } from "@reactive-resume/ui/components/textarea";
import { orpc } from "@/libs/orpc/client";
import { FlexibleDateInput } from "./flexible-date-input";

function nullable(value: string) {
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function currentLabel() {
	return t({
		comment: "Volunteer period checkbox and period label for an ongoing volunteer role",
		message: "Currently",
	});
}

export function VolunteerSection() {
	const profileQuery = useQuery(orpc.cvmateProfile.getCurrent.queryOptions({ input: {} }));
	const items = (profileQuery.data?.volunteer ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);

	const [organization, setOrganization] = useState("");
	const [role, setRole] = useState("");
	const [startDate, setStartDate] = useState("");
	const [endDate, setEndDate] = useState("");
	const [isCurrent, setIsCurrent] = useState(false);
	const [description, setDescription] = useState("");

	const [editingId, setEditingId] = useState<string | null>(null);
	const [editOrganization, setEditOrganization] = useState("");
	const [editRole, setEditRole] = useState("");
	const [editStartDate, setEditStartDate] = useState("");
	const [editEndDate, setEditEndDate] = useState("");
	const [editIsCurrent, setEditIsCurrent] = useState(false);
	const [editDescription, setEditDescription] = useState("");

	const hasCreateContent = [organization, role, startDate, endDate, description].some(
		(value) => value.trim().length > 0,
	);
	const hasEditContent = [editOrganization, editRole, editStartDate, editEndDate, editDescription].some(
		(value) => value.trim().length > 0,
	);

	const createMutation = useMutation({
		mutationFn: () =>
			orpc.cvmateProfile.createVolunteer.call({
				organization: nullable(organization),
				role: nullable(role),
				startDate: nullable(startDate),
				endDate: isCurrent ? null : nullable(endDate),
				isCurrent,
				description: nullable(description),
				sortOrder: items.length,
			}),
		onSuccess: () => {
			setOrganization("");
			setRole("");
			setStartDate("");
			setEndDate("");
			setIsCurrent(false);
			setDescription("");
			void profileQuery.refetch();
		},
	});

	const updateMutation = useMutation({
		mutationFn: () => {
			if (!editingId) throw new Error("No volunteer record selected.");

			return orpc.cvmateProfile.updateVolunteer.call({
				id: editingId,
				organization: nullable(editOrganization),
				role: nullable(editRole),
				startDate: nullable(editStartDate),
				endDate: editIsCurrent ? null : nullable(editEndDate),
				isCurrent: editIsCurrent,
				description: nullable(editDescription),
			});
		},
		onSuccess: () => {
			setEditingId(null);
			void profileQuery.refetch();
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => orpc.cvmateProfile.deleteVolunteer.call({ id }),
		onSuccess: () => void profileQuery.refetch(),
	});

	return (
		<section
			aria-labelledby="master-profile-volunteer"
			className="space-y-5 rounded-card border border-border bg-card p-4 sm:p-6"
		>
			<div>
				<h2 id="master-profile-volunteer" className="font-semibold text-foreground text-xl">
					<Trans>Volunteer work</Trans>
				</h2>
				<p className="text-muted-foreground text-sm">
					<Trans>Volunteer roles that can be relevant to an application.</Trans>
				</p>
			</div>

			<form
				className="space-y-4 rounded-card border border-border bg-muted p-4"
				onSubmit={(event) => {
					event.preventDefault();
					if (hasCreateContent) createMutation.mutate();
				}}
			>
				<div className="grid gap-3 md:grid-cols-2">
					<label className="space-y-1 text-sm">
						<span className="font-medium"><Trans>Organization</Trans></span>
						<Input
							aria-label={t`Organization`}
							value={organization}
							disabled={createMutation.isPending}
							onChange={(event) => setOrganization(event.target.value)}
						/>
					</label>
					<label className="space-y-1 text-sm">
						<span className="font-medium"><Trans>Role</Trans></span>
						<Input
							aria-label={t`Role`}
							value={role}
							disabled={createMutation.isPending}
							onChange={(event) => setRole(event.target.value)}
						/>
					</label>
				</div>

				<div className="flex flex-col gap-3 md:flex-row md:items-end">
					<label className="w-full space-y-1 text-sm md:w-72">
						<span className="font-medium"><Trans>From date</Trans></span>
						<FlexibleDateInput
							ariaLabel={t`From date`}
							placeholder={t`YYYY, YYYY-MM or YYYY-MM-DD`}
							value={startDate}
							disabled={createMutation.isPending}
							onChange={setStartDate}
						/>
					</label>
					<label className="w-full space-y-1 text-sm md:w-72">
						<span className="font-medium"><Trans>To date</Trans></span>
						<FlexibleDateInput
							ariaLabel={t`To date`}
							placeholder={t`YYYY, YYYY-MM or YYYY-MM-DD`}
							value={endDate}
							disabled={createMutation.isPending || isCurrent}
							onChange={setEndDate}
						/>
					</label>
					<label className="flex shrink-0 items-center gap-2 pb-2 text-base">
						<input
							type="checkbox"
							className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
							aria-label={currentLabel()}
							checked={isCurrent}
							disabled={createMutation.isPending}
							onChange={(event) => {
								setIsCurrent(event.target.checked);
								if (event.target.checked) setEndDate("");
							}}
						/>
						<Trans comment="Volunteer period checkbox for an ongoing volunteer role">Currently</Trans>
					</label>
				</div>

				<label className="block space-y-1 text-sm">
					<span className="font-medium"><Trans>Description</Trans></span>
					<Textarea
						className="min-h-24 resize-y"
						aria-label={t`Description`}
						value={description}
						disabled={createMutation.isPending}
						onChange={(event) => setDescription(event.target.value)}
					/>
				</label>

				<Button type="submit" className="w-fit" disabled={!hasCreateContent || createMutation.isPending}>
					{createMutation.isPending ? <Trans>Adding...</Trans> : <Trans>Add</Trans>}
				</Button>
			</form>

			<div className="space-y-2">
				{!profileQuery.isLoading && items.length === 0 ? (
					<p className="rounded-input border border-border bg-muted p-3 text-muted-foreground text-sm">
						<Trans>No records added yet.</Trans>
					</p>
				) : null}

				{items.map((item) => (
					<div key={item.id} className="rounded-card border border-border bg-background p-4">
						{editingId === item.id ? (
							<div className="space-y-4">
								<div className="grid gap-3 md:grid-cols-2">
									<label className="space-y-1 text-sm">
										<span className="font-medium"><Trans>Organization</Trans></span>
										<Input
											aria-label={t`Organization`}
											value={editOrganization}
											disabled={updateMutation.isPending}
											onChange={(event) => setEditOrganization(event.target.value)}
										/>
									</label>
									<label className="space-y-1 text-sm">
										<span className="font-medium"><Trans>Role</Trans></span>
										<Input
											aria-label={t`Role`}
											value={editRole}
											disabled={updateMutation.isPending}
											onChange={(event) => setEditRole(event.target.value)}
										/>
									</label>
								</div>

								<div className="flex flex-col gap-3 md:flex-row md:items-end">
									<label className="w-full space-y-1 text-sm md:w-72">
										<span className="font-medium"><Trans>From date</Trans></span>
										<FlexibleDateInput
											ariaLabel={t`From date`}
											placeholder={t`YYYY, YYYY-MM or YYYY-MM-DD`}
											value={editStartDate}
											disabled={updateMutation.isPending}
											onChange={setEditStartDate}
										/>
									</label>
									<label className="w-full space-y-1 text-sm md:w-72">
										<span className="font-medium"><Trans>To date</Trans></span>
										<FlexibleDateInput
											ariaLabel={t`To date`}
											placeholder={t`YYYY, YYYY-MM or YYYY-MM-DD`}
											value={editEndDate}
											disabled={updateMutation.isPending || editIsCurrent}
											onChange={setEditEndDate}
										/>
									</label>
									<label className="flex shrink-0 items-center gap-2 pb-2 text-base">
										<input
											type="checkbox"
											className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
											aria-label={currentLabel()}
											checked={editIsCurrent}
											disabled={updateMutation.isPending}
											onChange={(event) => {
												setEditIsCurrent(event.target.checked);
												if (event.target.checked) setEditEndDate("");
											}}
										/>
										<Trans comment="Volunteer period checkbox for an ongoing volunteer role">Currently</Trans>
									</label>
								</div>

								<label className="block space-y-1 text-sm">
									<span className="font-medium"><Trans>Description</Trans></span>
									<Textarea
										className="min-h-24 resize-y"
										aria-label={t`Description`}
										value={editDescription}
										disabled={updateMutation.isPending}
										onChange={(event) => setEditDescription(event.target.value)}
									/>
								</label>

								<div className="flex flex-wrap justify-end gap-2">
									<Button
										type="button"
										variant="outline"
										size="sm"
										disabled={updateMutation.isPending}
										onClick={() => setEditingId(null)}
									>
										<Trans>Cancel</Trans>
									</Button>
									<Button
										type="button"
										size="sm"
										disabled={!hasEditContent || updateMutation.isPending}
										onClick={() => updateMutation.mutate()}
									>
										{updateMutation.isPending ? <Trans>Saving...</Trans> : <Trans>Save changes</Trans>}
									</Button>
								</div>
							</div>
						) : (
							<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
								<div className="min-w-0 space-y-1 text-sm">
									<p className="font-medium">{item.role || item.organization || t`Volunteer work`}</p>
									{item.role && item.organization ? <p className="text-muted-foreground">{item.organization}</p> : null}
									<p className="text-muted-foreground">
										{item.startDate || item.date || "?"} {" - "}
										{item.isCurrent ? currentLabel() : item.endDate || "?"}
									</p>
									{item.description ? <p className="whitespace-pre-wrap">{item.description}</p> : null}
								</div>
								<div className="flex flex-wrap gap-2 sm:shrink-0">
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => {
											setEditingId(item.id);
											setEditOrganization(item.organization ?? "");
											setEditRole(item.role ?? "");
											setEditStartDate(item.startDate ?? item.date ?? "");
											setEditEndDate(item.endDate ?? "");
											setEditIsCurrent(item.isCurrent);
											setEditDescription(item.description ?? "");
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
