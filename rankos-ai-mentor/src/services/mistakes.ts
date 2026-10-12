/**
 * Mistake Bank API surface — `GET /mistakes`, `PATCH /mistakes/:id`
 * (see API_SPEC.md → "Page: /app/mistakes"). Typed `apiFetch` wrappers +
 * React Query `queryOptions`, mirroring `services/auth.ts`.
 */
import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { Mistake } from "@/types";

export interface MistakeFilters {
  status?: string;
  category?: string;
  q?: string;
  page?: number;
}

export interface MistakeListResponse {
  data: Mistake[];
  total: number;
}

export interface MistakeStatusResult {
  id: string;
  status: Mistake["status"];
}

/** Server-side equivalent of the old in-memory search/category/status filter. */
export function getMistakes(filters: MistakeFilters = {}, signal?: AbortSignal): Promise<MistakeListResponse> {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== "All") params.set("status", filters.status);
  if (filters.category && filters.category !== "All") params.set("category", filters.category);
  if (filters.q) params.set("q", filters.q);
  if (filters.page) params.set("page", String(filters.page));
  const qs = params.toString();
  return apiFetch<MistakeListResponse>(`/mistakes${qs ? `?${qs}` : ""}`, { signal });
}

/** Advance a mistake's revision status (Pending → Revised → Mastered). */
export function updateMistake(id: string, patch: { status: Mistake["status"] }): Promise<MistakeStatusResult> {
  return apiFetch<MistakeStatusResult>(`/mistakes/${id}`, { method: "PATCH", body: patch });
}

/** Generate a practice paper of questions similar to a logged mistake. */
export function practiceSimilar(id: string, count?: number): Promise<{ testId: string; code: string }> {
  return apiFetch<{ testId: string; code: string }>(`/mistakes/${id}/practice`, {
    method: "POST",
    body: count !== undefined ? { count } : {},
  });
}

export function mistakesQueryOptions(filters: MistakeFilters = {}) {
  return queryOptions({
    queryKey: ["mistakes", filters] as const,
    queryFn: ({ signal }) => getMistakes(filters, signal),
    staleTime: 30_000,
    retry: 1,
  });
}
