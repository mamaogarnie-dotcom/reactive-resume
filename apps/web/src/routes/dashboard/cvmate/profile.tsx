import type { FormEvent } from "react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { UserCircleIcon } from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@reactive-resume/ui/components/button";
import { Label } from "@reactive-resume/ui/components/label";
import { Separator } from "@reactive-resume/ui/components/separator";
import { getOrpcErrorMessage } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";
import { DashboardHeader } from "../-components/header";
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

const inputClassName =
	"h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

function nullable(value: string) {
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function RouteComponent() {
	const profileQuery = useQuery(orpc.cvmateProfile.getCurrent.queryOptions({ input: {} }));
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

			<div className="mx-auto max-w-3xl space-y-6">
				<div className="space-y-1">
					<h2 className="font-medium text-lg">
						<Trans>Personal details</Trans>
					</h2>
					<p className="text-muted-foreground text-sm">
						<Trans>
							Your Master Profile is the permanent source of facts used by CVMate when creating tailored resumes.
						</Trans>
					</p>
				</div>

				{profileQuery.isLoading ? (
					<p className="text-muted-foreground text-sm">
						<Trans>Loading profile...</Trans>
					</p>
				) : null}

				{profileQuery.isError ? (
					<div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive text-sm">
						<Trans>Could not load your Master Profile.</Trans>
					</div>
				) : null}

				{!profileQuery.isLoading && !profileQuery.isError && profileQuery.data === null ? (
					<div className="rounded-md border bg-muted/30 p-3 text-muted-foreground text-sm">
						<Trans>
							Your Master Profile has not been created yet. Saving these details will create it automatically.
						</Trans>
					</div>
				) : null}

				<form className="space-y-5" onSubmit={handleSubmit}>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-1.5">
							<Label htmlFor="cvmate-first-name">
								<Trans>First name</Trans>
							</Label>
							<input
								id="cvmate-first-name"
								className={inputClassName}
								value={form.firstName}
								disabled={profileQuery.isLoading || updateBasics.isPending}
								onChange={(event) => setField("firstName", event.target.value)}
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="cvmate-last-name">
								<Trans>Last name</Trans>
							</Label>
							<input
								id="cvmate-last-name"
								className={inputClassName}
								value={form.lastName}
								disabled={profileQuery.isLoading || updateBasics.isPending}
								onChange={(event) => setField("lastName", event.target.value)}
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="cvmate-email">
								<Trans>Email</Trans>
							</Label>
							<input
								id="cvmate-email"
								type="email"
								className={inputClassName}
								value={form.email}
								disabled={profileQuery.isLoading || updateBasics.isPending}
								onChange={(event) => setField("email", event.target.value)}
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="cvmate-phone">
								<Trans>Phone</Trans>
							</Label>
							<input
								id="cvmate-phone"
								type="tel"
								className={inputClassName}
								value={form.phone}
								disabled={profileQuery.isLoading || updateBasics.isPending}
								onChange={(event) => setField("phone", event.target.value)}
							/>
						</div>

						<div className="space-y-1.5 sm:col-span-2">
							<Label htmlFor="cvmate-location">
								<Trans>Location</Trans>
							</Label>
							<input
								id="cvmate-location"
								className={inputClassName}
								value={form.location}
								disabled={profileQuery.isLoading || updateBasics.isPending}
								onChange={(event) => setField("location", event.target.value)}
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="cvmate-linkedin">
								<Trans>LinkedIn</Trans>
							</Label>
							<input
								id="cvmate-linkedin"
								type="url"
								className={inputClassName}
								placeholder="https://linkedin.com/in/..."
								value={form.linkedinUrl}
								disabled={profileQuery.isLoading || updateBasics.isPending}
								onChange={(event) => setField("linkedinUrl", event.target.value)}
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="cvmate-website">
								<Trans>Website</Trans>
							</Label>
							<input
								id="cvmate-website"
								type="url"
								className={inputClassName}
								placeholder="https://..."
								value={form.websiteUrl}
								disabled={profileQuery.isLoading || updateBasics.isPending}
								onChange={(event) => setField("websiteUrl", event.target.value)}
							/>
						</div>
					</div>

					{updateBasics.isError ? (
						<div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive text-sm">
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
						<Button type="submit" disabled={profileQuery.isLoading || updateBasics.isPending}>
							{updateBasics.isPending ? <Trans>Saving...</Trans> : <Trans>Save</Trans>}
						</Button>
					</div>
				</form>

				<Separator />

				<WorkExperienceSection />

				<Separator />

				<ProfileDetailsSection />
			</div>
		</div>
	);
}
