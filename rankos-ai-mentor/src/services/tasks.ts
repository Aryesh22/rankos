/**
 * Study-task API surface — `GET /tasks`, `PATCH /tasks/:id`
 * (see API_SPEC.md → Dashboard / Planner). Typed `apiFetch` wrappers +
 * React Query `queryOptions`, mirroring `services/auth.ts`.
 */
import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { StudyTask } from "@/types";

export interface TaskListResponse {
  data: StudyTask[];
}

export interface TaskToggleResult {
  id: string;
  done: boolean;
}

/** List tasks for a given day (`date=today` or an ISO date). */
export function getTasks(date = "today", signal?: AbortSignal): Promise<TaskListResponse> {
  const query = new URLSearchParams({ date }).toString();
  return apiFetch<TaskListResponse>(`/tasks?${query}`, { signal });
}

/** Toggle (or otherwise patch) a single task — backs the checkbox. */
export function updateTask(taskId: string, patch: { done: boolean }): Promise<TaskToggleResult> {
  return apiFetch<TaskToggleResult>(`/tasks/${taskId}`, { method: "PATCH", body: patch });
}

export function tasksQueryOptions(date = "today") {
  return queryOptions({
    queryKey: ["tasks", date] as const,
    queryFn: ({ signal }) => getTasks(date, signal),
    staleTime: 30_000,
    retry: 1,
  });
}
