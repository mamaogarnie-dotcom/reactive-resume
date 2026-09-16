import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { PlusIcon, FileTextIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { CommandLoading } from "cmdk";
import { CommandItem, CommandShortcut } from "@reactive-resume/ui/components/command";
import { Kbd } from "@reactive-resume/ui/components/kbd";
import { orpc } from "@/libs/orpc/client";
import { useCommandPaletteStore } from "../store";
import { BaseCommandGroup } from "./base";

const matchesSearch = (search: string, values: Array<string | null | undefined>) => {
	const query = search.trim().toLowerCase();
	return !query || values.some((value) => value?.toLowerCase().includes(query));
};

export function ResumesCommandGroup() {
	const navigate = useNavigate();
	const { session } = useRouteContext({ strict: false });
	const reset = useCommandPaletteStore((state) => state.reset);
	const peekPage = useCommandPaletteStore((state) => state.peekPage);
	const pushPage = useCommandPaletteStore((state) => state.pushPage);
	const search = useCommandPaletteStore((state) => state.search);

	const commandPage = peekPage();
	const searchPage = commandPage === "resumes" ? "resumes" : undefined;

	const { data: resumes, isLoading } = useQuery(
		orpc.resume.list.queryOptions({
			enabled: !!session && searchPage === "resumes",
			input: { sort: "lastUpdatedAt", tags: [] },
		}),
	);

	const filteredResumes = (resumes ?? []).filter((resume) => matchesSearch(search, [resume.name, resume.slug]));

	const onCreate = async () => {
		await navigate({ to: "/dashboard/cvmate/create" });
		reset();
	};

	const onOpenResume = async (resumeId: string) => {
		await navigate({ to: "/builder/$resumeId", params: { resumeId } });
		reset();
	};

	if (!session) return null;

	return (
		<>
			<BaseCommandGroup heading={<Trans>Search for…</Trans>}>
				<CommandItem
					keywords={[t`My CV`, t`Resumes`, t`CV`]}
					value="search.resumes"
					onSelect={() => pushPage("resumes")}
				>
					<FileTextIcon />
					<Trans>My CV</Trans>
				</CommandItem>
			</BaseCommandGroup>

			{searchPage === "resumes" ? (
				<BaseCommandGroup page="resumes" heading={<Trans>My CV</Trans>}>
					<CommandItem value="resumes.create" onSelect={onCreate}>
						<PlusIcon />
						<Trans>Create CV</Trans>
					</CommandItem>

					{isLoading ? (
						<CommandLoading>
							<Trans>Loading resumes…</Trans>
						</CommandLoading>
					) : (
						filteredResumes.map((resume) => (
							<CommandItem
								key={resume.id}
								value={`resume.${resume.id}`}
								keywords={[resume.name, resume.slug]}
								onSelect={() => onOpenResume(resume.id)}
							>
								<FileTextIcon />
								{resume.name}

								<CommandShortcut className="opacity-0 transition-opacity group-data-[selected=true]/command-item:opacity-100">
									<Trans comment="Command palette hint that pressing Enter opens the selected resume">
										Press <Kbd>Enter</Kbd> to open
									</Trans>
								</CommandShortcut>
							</CommandItem>
						))
					)}
				</BaseCommandGroup>
			) : null}
		</>
	);
}
