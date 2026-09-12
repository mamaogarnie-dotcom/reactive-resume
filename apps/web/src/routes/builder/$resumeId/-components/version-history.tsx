import type { Resume } from "@/features/resume/builder/draft";
import { useResumeStore } from "@/features/resume/builder/draft";
import { ResumeVersionHistory } from "@/features/resume/version-history";

type BuilderVersionHistoryProps = {
	resumeId: string;
};

export function BuilderVersionHistory({ resumeId }: BuilderVersionHistoryProps) {
	const replaceResumeFromServer = useResumeStore((state) => state.replaceResumeFromServer);

	return (
		<ResumeVersionHistory resumeId={resumeId} onRestored={(restored) => replaceResumeFromServer(restored as Resume)} />
	);
}
