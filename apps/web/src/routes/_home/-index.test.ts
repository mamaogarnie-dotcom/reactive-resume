import { defaultResumeData } from "@reactive-resume/schema/resume/default";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
	ClientOnly: () => null,
	createFileRoute: () => (options: unknown) => ({ options }),
	lazyRouteComponent: () => () => null,
	redirect: (options: unknown) => options,
}));

vi.mock("@/libs/orpc/client", () => ({
	orpc: { resume: { getRoot: { queryOptions: () => ({ queryKey: ["root"] }) } } },
}));

const { Route } = await import("./index");

function runLoader(root: unknown, session: unknown = null) {
	const loader = Route.options.loader;
	if (typeof loader !== "function") throw new Error("Home loader is missing");

	return loader({
		context: {
			session,
			queryClient: {
				fetchQuery: vi.fn(async () => root),
			},
		},
	} as never);
}

describe("home root mode", () => {
	it("redirects an anonymous visitor to login when root resume mode is disabled", async () => {
		await expect(runLoader({ status: "disabled" })).rejects.toEqual({
			to: "/auth/login",
			replace: true,
		});
	});

	it("redirects an authenticated user directly to My CV when root resume mode is disabled", async () => {
		await expect(runLoader({ status: "disabled" }, { user: { id: "user-id" } })).rejects.toEqual({
			to: "/dashboard/resumes",
			search: { sort: "lastUpdatedAt", tags: [] },
			replace: true,
		});
	});

	it("keeps configured public root resumes available", async () => {
		const root = {
			status: "public",
			canonicalUrl: "https://configured.example/",
			username: "owner",
			slug: "resume",
			resume: { data: defaultResumeData, name: "Root Fixture" },
		};

		await expect(runLoader(root)).resolves.toEqual({ root });
	});

	it("uses 1story branding and server canonical root for public metadata", async () => {
		const head = await Route.options.head?.({
			loaderData: {
				root: {
					status: "public",
					canonicalUrl: "https://configured.example/",
					username: "owner",
					slug: "resume",
					resume: { data: defaultResumeData, name: "Root Fixture" },
				},
			},
		} as never);

		expect(head).toMatchObject({
			links: [{ rel: "canonical", href: "https://configured.example/" }],
		});
		expect(head?.meta).toContainEqual({ name: "robots", content: "noindex, follow" });
		expect(head?.meta).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					title: expect.stringContaining("1story"),
				}),
			]),
		);
	});

	it("keeps unavailable metadata free from target details", async () => {
		const head = await Route.options.head?.({
			loaderData: { root: { status: "unavailable", canonicalUrl: "https://configured.example/" } },
		} as never);

		expect(head?.meta).toContainEqual({ title: "1story" });
		expect(head?.meta).toContainEqual({ name: "robots", content: "noindex, follow" });
	});
});
