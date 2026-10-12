/**
 * Leaderboard API surface — `GET /leaderboard`
 * (see API_SPEC.md → "Page: /app/leaderboard"). Typed `apiFetch` wrappers +
 * React Query `queryOptions`, mirroring `services/auth.ts`.
 */
import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { LeaderboardEntry } from "@/types";

export type LeaderboardScope = "friends" | "institute" | "state" | "india";
export type LeaderboardRange = "weekly" | "monthly" | "overall";

export interface LeaderboardFilters {
  scope?: LeaderboardScope;
  range?: LeaderboardRange;
  page?: number;
  limit?: number;
}

export interface LeaderboardResponse {
  scope: string;
  range: string;
  podium: LeaderboardEntry[];
  data: LeaderboardEntry[];
  you?: { rank: number };
  total: number;
}

export function getLeaderboard(filters: LeaderboardFilters = {}, signal?: AbortSignal): Promise<LeaderboardResponse> {
  const params = new URLSearchParams();
  params.set("scope", filters.scope ?? "india");
  params.set("range", filters.range ?? "weekly");
  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  return apiFetch<LeaderboardResponse>(`/leaderboard?${params.toString()}`, { signal });
}

/**
 * Flatten `podium` + `data` into a single, rank-ordered list (deduped by rank).
 * Both the Leaderboard and Tests pages render from one ranked array.
 */
export function flattenLeaderboard(res: LeaderboardResponse | undefined): LeaderboardEntry[] {
  if (!res) return [];
  const seen = new Set<number>();
  const merged: LeaderboardEntry[] = [];
  for (const entry of [...(res.podium ?? []), ...(res.data ?? [])]) {
    if (seen.has(entry.rank)) continue;
    seen.add(entry.rank);
    merged.push(entry);
  }
  return merged.sort((a, b) => a.rank - b.rank);
}

export function leaderboardQueryOptions(filters: LeaderboardFilters = {}) {
  return queryOptions({
    queryKey: ["leaderboard", filters] as const,
    queryFn: ({ signal }) => getLeaderboard(filters, signal),
    staleTime: 30_000,
    retry: 1,
  });
}
