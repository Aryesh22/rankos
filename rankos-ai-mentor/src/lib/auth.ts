/**
 * Session state + route-guard helpers.
 *
 * The session is a single React Query entry (`["auth","session"]`) that resolves
 * to the current {@link User} or `null`. `useAuth()` reads it in components; the
 * `requireAuth` / `requireRole` / `redirectIfAuthenticated` helpers drive the
 * router `beforeLoad` guards and share the same cache, so a guard fetch is reused
 * by the app shell without a second round-trip.
 */
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { redirect, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { isApiError } from "@/lib/api";
import { authApi } from "@/services/auth";
import type { Role, User } from "@/types";

export const SESSION_QUERY_KEY = ["auth", "session"] as const;

/**
 * Resolve the session user, or `null` when the visitor isn't signed in.
 *
 * A 401 is the normal "logged out" signal. Network/5xx failures are also mapped
 * to `null` so a backend hiccup routes the user to `/login` instead of crashing
 * the guarded shell; the underlying error is logged for diagnosis.
 */
export async function fetchSession(signal?: AbortSignal): Promise<User | null> {
  try {
    return await authApi.me(signal);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    if (!isApiError(error, 401)) {
      console.warn("Session check failed:", error);
    }
    return null;
  }
}

export function sessionQueryOptions() {
  return queryOptions({
    queryKey: SESSION_QUERY_KEY,
    queryFn: ({ signal }) => fetchSession(signal),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/** Component hook exposing the current session. */
export function useAuth() {
  const query = useQuery(sessionQueryOptions());
  return {
    user: query.data ?? null,
    isAuthenticated: Boolean(query.data),
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}

/**
 * Sign out: revoke the server session, wipe every cached query (so no stale
 * per-user data lingers), and return to the login screen. The local cleanup runs
 * even if the network call fails, so the user is never stuck "half signed-in".
 */
export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      queryClient.setQueryData(SESSION_QUERY_KEY, null);
      queryClient.clear();
      toast.success("Signed out.");
      navigate({ to: "/login" });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Route guards (used from `beforeLoad`)                               */
/* ------------------------------------------------------------------ */

interface GuardArgs {
  context: { queryClient: QueryClient };
  location: { href: string };
}

// During SSR the httpOnly session cookie can't be read through a relative
// fetch, so guards defer to the client, which re-runs `beforeLoad` on hydration.
const isServer = () => typeof window === "undefined";

/** Redirect to `/login` (preserving the return path) unless authenticated. */
export async function requireAuth({ context, location }: GuardArgs): Promise<{ user?: User }> {
  if (isServer()) return {};
  const user = await context.queryClient.ensureQueryData(sessionQueryOptions());
  if (!user) {
    throw redirect({ to: "/login", search: { redirect: location.href } });
  }
  return { user };
}

/** Like {@link requireAuth} but also enforces a role allow-list. */
export async function requireRole(roles: Role[], args: GuardArgs): Promise<{ user?: User }> {
  const result = await requireAuth(args);
  if (result.user && !roles.includes(result.user.role)) {
    throw redirect({ to: "/app" });
  }
  return result;
}

/** Bounce already-signed-in users away from auth pages into the app. */
export async function redirectIfAuthenticated({ context }: GuardArgs): Promise<void> {
  if (isServer()) return;
  const user = await context.queryClient.ensureQueryData(sessionQueryOptions());
  if (user) {
    throw redirect({ to: "/app" });
  }
}

/** Only allow same-origin, absolute-path redirects (blocks open-redirects). */
export function sanitizeRedirect(target: string | undefined): string {
  if (target && target.startsWith("/") && !target.startsWith("//")) {
    return target;
  }
  return "/app";
}
