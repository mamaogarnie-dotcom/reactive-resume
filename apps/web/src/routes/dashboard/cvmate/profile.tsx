import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { UserCircleIcon } from "@phosphor-icons/react";
import { Button } from "@reactive-resume/ui/components/button";
import { Input } from "@reactive-resume/ui/components/input";
import { Label } from "@reactive-resume/ui/components/label";
import { Separator } from "@reactive-resume/ui/components/separator";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { getOrpcErrorMessage } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";
import { DashboardHeader } from "../-components/header";
import { AchievementsSection } from "./-components/achievements";
import { ProfileDetailsSection } from "./-components/profile-details";
import { WorkExperienceSection } from "./-components/work-experience";

export const Route = createFileRoute("/dashboard/cvmate/profile")({
	component: RouteComponent,
});

type BasicsForm = {
	firstName: string;
	lastName: string;
	email: string;
	phone: string;
	location: string;
	linkedinUrl: string;
	websiteUrl: string;
};

const EMPTY_FORM: BasicsForm = {
	firstName: "",
	lastName: "",
	email: "",
	phone: "",
	location: "",
	linkedinUrl: "",
	websiteUrl: "",
};

function nullable(value: string) {
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function RouteComponent() {
	const profileQuery = useQuery(
		orpc.cvmateProfile.getCurrent.queryOptions({ input: {} }),
	);
	const [form, setForm] = useState<BasicsForm>(EMPTY_FORM);

	const updateBasics = useMutation(
		orpc.cvmateProfile.updateBasics.mutationOptions({
			onSuccess: () => {
				void profileQuery.refetch();
			},
		}),
	);

	useEffect(() => {
		const profile = profileQuery.data?.profile;

		if (!profile) {
			setForm(EMPTY_FORM);
			return;
		}

		setForm({
			firstName: profile.firstName ?? "",
			lastName: profile.lastName ?? "",
			email: profile.email ?? "",
			phone: profile.phone ?? "",
			location: profile.location ?? "",
			linkedinUrl: profile.linkedinUrl ?? "",
			websiteUrl: profile.websiteUrl ?? "",
		});
	}, [profileQuery.data]);

	const setField = (field: keyof BasicsForm, value: string) => {
		setForm((current) => ({ ...current, [field]: value }));
	};

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		updateBasics.mutate({
			firstName: nullable(form.firstName),
			lastName: nullable(form.lastName),
			email: nullable(form.email),
			phone: nullable(form.phone),
			location: nullable(form.location),
			linkedinUrl: nullable(form.linkedinUrl),
			websiteUrl: nullable(form.websiteUrl),
		});
	};

	return (
		<div className="space-y-4">
			<DashboardHeader icon={UserCircleIcon} title={t`Master Profile`} />

			<Separator />

			<div className="mx-auto max-w-5xl space-y-8">
				<section
					aria-labelledby="master-profile-personal-details"
					className="space-y-5 rounded-card border border-border bg-card p-4 sm:p-6"
				>
				<div className="space-y-1">
					<h2 id="master-profile-personal-details" className="text-xl font-semibold text-foreground">
						<Trans>Personal details</Trans>
					</h2>
					<p className="text-muted-foreground text-sm">
						<Trans>
							Your Master Profile is the permanent source of facts used by
							1story when creating tailored resumes.
						</Trans>
					</p>
				</div>

				{profileQuery.isLoading ? (
					<p className="text-muted-foreground text-sm">
						<Trans>Loading profile...</Trans>
					</p>
				) : null}

				{profileQuery.isError ? (
					<div className="rounded-card border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm">
						<Trans>Could not load your Master Profile.</Trans>
					</div>
				) : null}

				{!profileQuery.isLoading &&
				!profileQuery.isError &&
				profileQuery.data === null ? (
					<div className="rounded-card border border-border bg-muted p-3 text-muted-foreground text-sm">
						<Trans>
							Your Master Profile has not been created yet. Saving these details
							will create it automatically.
						</Trans>
					</div>
				) : null}

				<form className="space-y-5" onSubmit={handleSubmit}>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-1.5">
							<Label htmlFor="cvmate-first-name">
								<Trans>First name</Trans>
							</Label>
							<Input
								id="cvmate-first-name"
								value={form.firstName}
								disabled={profileQuery.isLoading || updateBasics.isPending}
								onChange={(event) => setField("firstName", event.target.value)}
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="cvmate-last-name">
								<Trans>Last name</Trans>
							</Label>
							<Input
								id="cvmate-last-name"
								value={form.lastName}
								disabled={profileQuery.isLoading || updateBasics.isPending}
								onChange={(event) => setField("lastName", event.target.value)}
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="cvmate-email">
								<Trans>Email</Trans>
							</Label>
							<Input
								id="cvmate-email"
								type="email"
								value={form.email}
								disabled={profileQuery.isLoading || updateBasics.isPending}
								onChange={(event) => setField("email", event.target.value)}
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="cvmate-phone">
								<Trans>Phone</Trans>
							</Label>
							<Input
								id="cvmate-phone"
								type="tel"
								value={form.phone}
								disabled={profileQuery.isLoading || updateBasics.isPending}
								onChange={(event) => setField("phone", event.target.value)}
							/>
						</div>

						<div className="space-y-1.5 sm:col-span-2">
							<Label htmlFor="cvmate-location">
								<Trans>Location</Trans>
							</Label>
							<Input
								id="cvmate-location"
								value={form.location}
								disabled={profileQuery.isLoading || updateBasics.isPending}
								onChange={(event) => setField("location", event.target.value)}
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="cvmate-linkedin">
								<Trans>LinkedIn</Trans>
							</Label>
							<Input
								id="cvmate-linkedin"
								type="url"
								placeholder="https://linkedin.com/in/..."
								value={form.linkedinUrl}
								disabled={profileQuery.isLoading || updateBasics.isPending}
								onChange={(event) =>
									setField("linkedinUrl", event.target.value)
								}
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="cvmate-website">
								<Trans>Website</Trans>
							</Label>
							<Input
								id="cvmate-website"
								type="url"
								placeholder="https://..."
								value={form.websiteUrl}
								disabled={profileQuery.isLoading || updateBasics.isPending}
								onChange={(event) => setField("websiteUrl", event.target.value)}
							/>
						</div>
					</div>

					{updateBasics.isError ? (
						<div className="rounded-card border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm">
							{getOrpcErrorMessage(updateBasics.error, {
								fallback: t`Could not save your profile.`,
							})}
						</div>
					) : null}

					{updateBasics.isSuccess ? (
						<p className="text-muted-foreground text-sm">
							<Trans>Profile saved.</Trans>
						</p>
					) : null}

					<div className="flex justify-end">
						<Button
							type="submit"
							disabled={profileQuery.isLoading || updateBasics.isPending}
						>
							{updateBasics.isPending ? (
								<Trans>Saving...</Trans>
							) : (
								<Trans>Save</Trans>
							)}
						</Button>
					</div>
				</form>
				</section>

				<Separator />

				<WorkExperienceSection />

				<Separator />

				<AchievementsSection />

				<Separator />

				<ProfileDetailsSection />
			</div>
		</div>
	);
}
