import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { authClient } from "@/libs/auth/client";
import { clearAuthenticatedQueryCache } from "@/libs/query/client";

/**
 * Czyści cache zapytań za każdym razem, gdy zmienia się zalogowany użytkownik
 * (logowanie, 2FA, wygaśnięcie sesji i zalogowanie innego konta w tej samej karcie).
 */
export function SessionCacheGuard() {
	const queryClient = useQueryClient();
	const { data: session, isPending } = authClient.useSession();
	const previousUserId = useRef<string | null | undefined>(undefined);
	const currentUserId = session?.user?.id ?? null;

	useEffect(() => {
		if (isPending) return;
		if (previousUserId.current !== undefined && previousUserId.current !== currentUserId) {
			clearAuthenticatedQueryCache(queryClient);
		}
		previousUserId.current = currentUserId;
	}, [currentUserId, isPending, queryClient]);

	return null;
}
