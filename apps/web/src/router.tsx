import { createRouter } from "@tanstack/react-router";
import { ErrorScreen } from "./components/layout/error-screen";
import { LoadingScreen } from "./components/layout/loading-screen";
import { NotFoundScreen } from "./components/layout/not-found-screen";
import { getSession } from "./libs/auth/session";
import { getLocale, loadLocale } from "./libs/locale";
import { client, orpc } from "./libs/orpc/client";
import { getQueryClient } from "./libs/query/client";
import { getTheme } from "./libs/theme";

export const getRouter = async () => {
	const queryClient = getQueryClient();

	const [theme, locale, session, flags] = await Promise.all([
		getTheme(),
		getLocale(),
		getSession(),
		client.flags.get(),
	]);

	await loadLocale(locale);

	// Route modules may execute Lingui translations at module scope.
	// Import them only after the application locale has been activated.
	const { routeTree } = await import("./routeTree.gen");

	const router = createRouter({
		routeTree,
		scrollRestoration: true,
		defaultViewTransition: true,
		defaultStructuralSharing: true,
		defaultErrorComponent: ErrorScreen,
		defaultPendingComponent: LoadingScreen,
		defaultNotFoundComponent: NotFoundScreen,
		context: { orpc, queryClient, theme, locale, session, flags },
	});

	return router;
};
