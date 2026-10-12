/**
 * Profile API surface — `GET /profile`, `GET /profile/achievements`
 * (see API_SPEC.md → "Page: /app/profile"). Typed `apiFetch` wrappers +
 * React Query `queryOptions`.
 */
import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface Profile {
  name: string;
  initials: string;
  exam: string;
  institute: string;
  state: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  nextLevelXp: number;
  targetRank: number;
  currentPredictedRank: number;
  syllabusCovered: number;
  dreamCollege: string;
  longestStreak: number;
  streak: number;
}

export interface Achievement {
  name: string;
  detail: string;
  icon: string;
  earned: boolean;
}

export interface AchievementsResponse {
  data: Achievement[];
  earnedCount: number;
  total: number;
}

export function getProfile(signal?: AbortSignal): Promise<Profile> {
  return apiFetch<Profile>("/profile", { signal });
}

export function getAchievements(signal?: AbortSignal): Promise<AchievementsResponse> {
  return apiFetch<AchievementsResponse>("/profile/achievements", { signal });
}

export function profileQueryOptions() {
  return queryOptions({
    queryKey: ["profile"] as const,
    queryFn: ({ signal }) => getProfile(signal),
    staleTime: 30_000,
    retry: 1,
  });
}

export function achievementsQueryOptions() {
  return queryOptions({
    queryKey: ["profile", "achievements"] as const,
    queryFn: ({ signal }) => getAchievements(signal),
    staleTime: 30_000,
    retry: 1,
  });
}
