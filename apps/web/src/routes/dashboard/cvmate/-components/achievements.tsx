import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Button } from "@reactive-resume/ui/components/button";
import { Input } from "@reactive-resume/ui/components/input";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { orpc } from "@/libs/orpc/client";

export function AchievementsSection() {
const [achievementText, setAchievementText] = useState("");
const [editingId, setEditingId] = useState<string | null>(null);
const [editText, setEditText] = useState("");

const profileQuery = useQuery(
orpc.cvmateProfile.getCurrent.queryOptions({ input: {} }),
);

const achievements = (profileQuery.data?.experienceFacts ?? []).filter(
(fact) => fact.kind === "achievement",
);

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
className="space-y-5 rounded-card border border-border bg-card p-4 sm:p-6"
>
<div className="space-y-1">
<h2
id="master-profile-achievements"
className="text-xl font-semibold text-foreground"
>
<Trans>Achievements</Trans>
</h2>

<p className="text-muted-foreground text-sm">
<Trans>
Add concrete results, improvements, measurable impact, or other professional
achievements worth using in a tailored resume.
</Trans>
</p>
</div>

<form
className="flex flex-col gap-2 rounded-card border border-border bg-muted p-4 sm:flex-row"
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
className="shrink-0"
disabled={!trimmedAchievement || createAchievement.isPending}
>
{createAchievement.isPending ? (
<Trans>Adding...</Trans>
) : (
<Trans>Add achievement</Trans>
)}
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
<p className="text-muted-foreground text-sm">
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

{!profileQuery.isLoading &&
!profileQuery.isError &&
achievements.length === 0 ? (
<p className="rounded-input border border-border bg-muted p-3 text-muted-foreground text-sm">
<Trans>No achievements added yet.</Trans>
</p>
) : null}

{achievements.length > 0 ? (
<div className="space-y-3">
{achievements.map((achievement) => (
<div
key={achievement.id}
className="rounded-card border border-border bg-background p-4"
>
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
{updateAchievement.isPending ? (
<Trans>Saving...</Trans>
) : (
<Trans>Save</Trans>
)}
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
<p className="min-w-0 flex-1 text-sm">{achievement.text}</p>

<div className="flex flex-wrap gap-2 sm:shrink-0">
<Button
type="button"
variant="outline"
size="sm"
onClick={() => {
setEditingId(achievement.id);
setEditText(achievement.text);
}}
>
<Trans>Edit</Trans>
</Button>

<Button
type="button"
variant="outline"
size="sm"
disabled={deleteAchievement.isPending}
onClick={() =>
deleteAchievement.mutate({ id: achievement.id })
}
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
