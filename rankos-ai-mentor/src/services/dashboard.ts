/**
 * Dashboard API surface — the single aggregate read that backs `/app`
 * (see API_SPEC.md → "Page: /app — Dashboard"). Thin, typed `apiFetch`
 * wrappers plus React Query `queryOptions`, mirroring `services/auth.ts`.
 */
import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { StudyTask } from "@/types";

export interface DashboardStudent {
  streak: number;
  currentPredictedRank: number;
  targetRank: number;
  accuracy: number;
  hoursThisWeek: number;
  xp: number;
  level: number;
  /** Not part of the core aggregate; surfaced when the API provides it. */
  longestStreak?: number;
}

export interface WeeklyGoal {
  label: string;
  current: number;
  target: number;
  unit: string;
}

export interface ScoreTrendPoint {
  test: string;
  score: number;
  percentile: number;
  topper: number;
}

export interface RevisionQueueItem {
  id: string;
  question: string;
  subject: string;
  priority: "High" | "Medium" | "Low";
  status: string;
  chapter?: string;
  category?: string;
  timesRepeated?: number;
}

export interface DashboardTest {
  id: string;
  code?: string;
  title: string;
  difficulty: string;
  questions: number;
  durationMin: number;
  maxScore: number;
  scheduledFor?: string;
}

export interface AiInsight {
  headline: string;
  topics: string[];
}

export interface DashboardResponse {
  student: DashboardStudent;
  todayPlan: StudyTask[];
  weeklyGoals: WeeklyGoal[];
  scoreTrend: ScoreTrendPoint[];
  revisionQueue: RevisionQueueItem[];
  upcomingTests: DashboardTest[];
  aiInsight: AiInsight;
}

/** One aggregate read for the whole dashboard. */
export function getDashboard(signal?: AbortSignal): Promise<DashboardResponse> {
  return apiFetch<DashboardResponse>("/dashboard", { signal });
}

export function dashboardQueryOptions() {
  return queryOptions({
    queryKey: ["dashboard"] as const,
    queryFn: ({ signal }) => getDashboard(signal),
    staleTime: 30_000,
    retry: 1,
  });
}
