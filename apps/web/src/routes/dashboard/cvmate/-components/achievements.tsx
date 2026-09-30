import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { TrophyIcon } from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@reactive-resume/ui/components/button";
import { Input } from "@reactive-resume/ui/components/input";
import { orpc } from "@/libs/orpc/client";

export function AchievementsSection() {
	const [achievementText, setAchievementText] = useState("");
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editText, setEditText] = useState("");

	const profileQuery = useQuery(orpc.cvmateProfile.getCurrent.queryOptions({ input: {} }));

	const achievements = (profileQuery.data?.experienceFacts ?? []).filter((fact) => fact.kind === "achievement");

	const createAchievement = useMutation(
		orpc.cvmateProfile.createExperienceFact.mutationOptions({
			onSuccess: () => {
				setAchievementText("");
				void profileQuery.refetch();
			},
		}),
	);

	const updateAchievement = useMutation(
		orpc.cvmateProfile.updateExperienceFact.mutationOptions({
			onSuccess: () => {
				setEditingId(null);
				setEditText("");
				void profileQuery.refetch();
			},
		}),
	);

	const deleteAchievement = useMutation(
		orpc.cvmateProfile.deleteExperienceFact.mutationOptions({
			onSuccess: () => {
				void profileQuery.refetch();
			},
		}),
	);

	const trimmedAchievement = achievementText.trim();
	const trimmedEditText = editText.trim();

	return (
		<section
			aria-labelledby="master-profile-achievements"
			className="space-y-5 rounded-card border border-[#D9E3D2] bg-white p-4 sm:p-6"
		>
			<div className="flex items-start gap-3">
				<div
					aria-hidden="true"
					className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-[#E2C5E7] text-[#A878AA]"
				>
					<TrophyIcon className="size-4" />
				</div>
				<div className="space-y-1">
					<h2 id="master-profile-achievements" className="font-semibold text-[#3C4F27] text-xl">
						<Trans>Achievements</Trans>
					</h2>
					<p className="text-[#65745A] text-sm">
						<Trans>
							Add concrete results, improvements, measurable impact, or other professional achievements worth using in a
							tailored resume.
						</Trans>
					</p>
				</div>
			</div>

			<form
				className="flex flex-col gap-2 rounded-card border border-[#D9E3D2] bg-[#F8FAF5] p-4 sm:flex-row"
				onSubmit={(event) => {
					event.preventDefault();

					if (!trimmedAchievement) return;

					createAchievement.mutate({
						text: trimmedAchievement,
						kind: "achievement",
					});
				}}
			>
				<Input
					className="min-w-0 flex-1"
					aria-label={t`Achievement`}
					placeholder={t`e.g. Reduced processing time by 30%`}
					value={achievementText}
					disabled={createAchievement.isPending}
					onChange={(event) => setAchievementText(event.target.value)}
				/>

				<Button
					type="submit"
					variant="outline"
					size="sm"
					className="shrink-0 border-[#91A482] bg-white text-[#3C4F27] hover:border-[#3C4F27] hover:bg-[#EEF3E8] hover:text-[#3C4F27] focus-visible:border-[#3C4F27] focus-visible:ring-[rgba(168,120,170,0.18)]"
					disabled={!trimmedAchievement || createAchievement.isPending}
				>
					{createAchievement.isPending ? <Trans>Adding...</Trans> : <Trans>Add achievement</Trans>}
				</Button>
			</form>

			{createAchievement.isError ? (
				<p
					role="alert"
					className="rounded-input border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm"
				>
					<Trans>Could not add this achievement.</Trans>
				</p>
			) : null}

			{profileQuery.isLoading ? (
				<p className="text-[#65745A] text-sm">
					<Trans>Loading achievements...</Trans>
				</p>
			) : null}

			{profileQuery.isError ? (
				<p
					role="alert"
					className="rounded-input border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm"
				>
					<Trans>Could not load achievements.</Trans>
				</p>
			) : null}

			{!profileQuery.isLoading && !profileQuery.isError && achievements.length === 0 ? (
				<p className="rounded-input border border-[#E4EBDD] bg-[#F8FAF5] p-3 text-[#65745A] text-sm">
					<Trans>No achievements added yet.</Trans>
				</p>
			) : null}

			{achievements.length > 0 ? (
				<div className="space-y-3">
					{achievements.map((achievement) => (
						<div key={achievement.id} className="rounded-card border border-[#E4EBDD] bg-white p-4 transition-colors hover:border-[#8FA27F] hover:bg-[#F1F5EC] focus-within:border-[#8FA27F] focus-within:bg-[#F3F6EF]">
							{editingId === achievement.id ? (
								<div className="flex flex-col gap-2 sm:flex-row">
									<Input
										className="min-w-0 flex-1"
										aria-label={t`Achievement`}
										value={editText}
										disabled={updateAchievement.isPending}
										onChange={(event) => setEditText(event.target.value)}
									/>

									<div className="flex flex-wrap gap-2">
										<Button
											type="button"
											variant="outline"
											size="sm"
											disabled={!trimmedEditText || updateAchievement.isPending}
											onClick={() =>
												updateAchievement.mutate({
													id: achievement.id,
													text: trimmedEditText,
												})
											}
										>
											{updateAchievement.isPending ? <Trans>Saving...</Trans> : <Trans>Save</Trans>}
										</Button>

										<Button
											type="button"
											variant="outline"
											size="sm"
											disabled={updateAchievement.isPending}
											onClick={() => {
												setEditingId(null);
												setEditText("");
											}}
										>
											<Trans>Cancel</Trans>
										</Button>
									</div>
								</div>
							) : (
								<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
									<div className="flex min-w-0 flex-1 items-start gap-2"><span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-[#5E7B49]" /><p className="min-w-0 flex-1 text-sm">{achievement.text}</p></div>

									<div className="flex flex-wrap gap-1.5 sm:shrink-0">
										<Button
											type="button"
											variant="edit"
											size="sm"
											className="min-w-[4.5rem] border-[#91A482] bg-white text-[#3C4F27] hover:border-[#3C4F27] hover:bg-[#EEF3E8] hover:text-[#3C4F27] focus-visible:border-[#3C4F27] focus-visible:ring-[rgba(168,120,170,0.18)]"
											onClick={() => {
												setEditingId(achievement.id);
												setEditText(achievement.text);
											}}
										>
											<Trans>Edit</Trans>
										</Button>

										<Button
											type="button"
											variant="delete"
											size="sm"
											className="min-w-[4rem] border-[#E4A18D] bg-white text-[#B45E43] hover:border-[#C96C50] hover:bg-[#FFF2ED] hover:text-[#B45E43] focus-visible:border-[#3C4F27] focus-visible:ring-[rgba(168,120,170,0.18)]"
											disabled={deleteAchievement.isPending}
											onClick={() => deleteAchievement.mutate({ id: achievement.id })}
										>
											<Trans>Delete</Trans>
										</Button>
									</div>
								</div>
							)}
						</div>
					))}
				</div>
			) : null}

			{updateAchievement.isError ? (
				<p
					role="alert"
					className="rounded-input border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm"
				>
					<Trans>Could not update this achievement.</Trans>
				</p>
			) : null}

			{deleteAchievement.isError ? (
				<p
					role="alert"
					className="rounded-input border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm"
				>
					<Trans>Could not delete this achievement.</Trans>
				</p>
			) : null}
		</section>
	);
}
