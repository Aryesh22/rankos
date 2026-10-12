/**
 * Study-plan API surface — `GET /plans`, `POST /plans/generate`, `POST /pomodoro`
 * (see API_SPEC.md → "Page: /app/planner"). Typed `apiFetch` wrappers +
 * React Query `queryOptions`, mirroring `services/tasks.ts`.
 */
import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type PlanScope = "week" | "month";

export interface PlanItem {
  title: string;
  subject: string;
  minutes: number;
  type: string;
}

export interface PlanDay {
  date: string;
  load: number;
  items: PlanItem[];
}

export interface PlanResponse {
  scope: string;
  periodStart: string;
  days: PlanDay[];
  /** AI roadmap blurb summarising the plan; null when not generated. */
  narrative: string | null;
}

/** Read the current week/month plan grid. */
export function getPlans(scope: PlanScope, start?: string, signal?: AbortSignal): Promise<PlanResponse> {
  const params = new URLSearchParams({ scope });
  if (start) params.set("start", start);
  return apiFetch<PlanResponse>(`/plans?${params.toString()}`, { signal });
}

/** Regenerate the plan for a scope; returns the freshly built plan. */
export function generatePlan(input: {
  scope: PlanScope;
  start?: string;
  constraints?: Record<string, unknown>;
}): Promise<{ plan: PlanResponse }> {
  return apiFetch<{ plan: PlanResponse }>("/plans/generate", {
    method: "POST",
    body: { ...input },
  });
}

/** Log a completed (or abandoned) pomodoro focus session. */
export function logPomodoro(input: {
  focusMinutes: number;
  taskId?: string | null;
  completed: boolean;
}): Promise<{ id: string }> {
  return apiFetch<{ id: string }>("/pomodoro", { method: "POST", body: { ...input } });
}

export function weekPlanQueryOptions(scope: PlanScope = "week", start?: string) {
  return queryOptions({
    queryKey: ["plans", scope, start ?? null] as const,
    queryFn: ({ signal }) => getPlans(scope, start, signal),
    staleTime: 30_000,
    retry: 1,
  });
}

export function monthPlanQueryOptions(start?: string) {
  return weekPlanQueryOptions("month", start);
}
