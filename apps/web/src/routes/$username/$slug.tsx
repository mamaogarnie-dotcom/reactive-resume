import { ORPCError } from "@orpc/client";
import { getResumeSocialMeta } from "@reactive-resume/resume/social-meta";
import type { ResumeData } from "@reactive-resume/schema/resume/data";
import { createFileRoute, lazyRouteComponent, notFound, redirect } from "@tanstack/react-router";
import type { RouterOutput } from "@/libs/orpc/client";
import { orpc } from "@/libs/orpc/client";
import { createNoindexFollowMeta, createResumeSocialMeta, getCanonicalRootUrl } from "@/libs/seo";

type LoaderData = Omit<RouterOutput["resume"]["getBySlug"], "data"> & { data: ResumeData };

export const Route = createFileRoute("/$username/$slug")({
	ssr: "data-only",
	component: lazyRouteComponent(() => import("@/features/resume/public/public-resume"), "PublicResumeRoute"),
	loader: async ({ context, params }) => {
		const { username, slug } = params;
		const resume = await context.queryClient.ensureQueryData(
			orpc.resume.getBySlug.queryOptions({ input: { username, slug } }),
		);

		return { resume: resume as LoaderData };
	},
	head: ({ loaderData, params }) => {
		const resume = loaderData?.resume;
		const name = resume ? resume.data.basics.name || resume.name || "CV" : "CV";

		if (!resume) {
			return { meta: [{ title: `${name} - 1story` }, createNoindexFollowMeta()] };
		}

		const social = getResumeSocialMeta(resume.data, resume.name || "CV");

		const origin = typeof window === "undefined" ? null : window.location.origin;

		if (!origin) {
			return {
				meta: [{ title: `${social.name} - 1story` }, createNoindexFollowMeta()],
			};
		}

		const base = getCanonicalRootUrl(origin);
		const canonicalUrl = `${base}${params.username}/${params.slug}`;
		const imageUrl = `${base}opengraph/banner.jpg`;

		return {
			meta: [
				{ title: `${social.name} - 1story` },
				createNoindexFollowMeta(),
				...createResumeSocialMeta({
					canonicalUrl,
					title: social.title,
					description: social.description,
					imageUrl,
				}),
			],
			links: [{ rel: "canonical", href: canonicalUrl }],
		};
	},
	onError: (error) => {
		if (error instanceof ORPCError && error.code === "NEED_PASSWORD") {
			const data = error.data as { username?: string; slug?: string } | undefined;
			const username = data?.username;
			const slug = data?.slug;

			if (username && slug) {
				throw redirect({
					to: "/auth/resume-password",
					search: { redirect: `/${username}/${slug}` },
				});
			}
		}

		throw notFound();
	},
});
