/**
 * Parent View API surface — `GET /parent/children`, `GET /parent/report`
 * (see API_SPEC.md → "Page: /app/parent"). Typed `apiFetch` wrappers +
 * React Query `queryOptions`.
 */
import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface ParentChild {
  studentId: string;
  name: string;
  exam: string;
}

export interface ParentChildrenResponse {
  data: ParentChild[];
}

export interface ParentReport {
  student: { name: string };
  studyTimeWeek: { day: string; hours: number; target: number }[];
  attendance: number;
  focusScore: number;
  burnoutRisk: string;
  subjectBreakdown: { subject: string; accuracy: number }[];
  recommendation: string;
  hoursThisWeek?: number;
}

export function getParentChildren(signal?: AbortSignal): Promise<ParentChildrenResponse> {
  return apiFetch<ParentChildrenResponse>("/parent/children", { signal });
}

export function getParentReport(params: { studentId?: string; week?: string } = {}, signal?: AbortSignal): Promise<ParentReport> {
  const search = new URLSearchParams();
  if (params.studentId) search.set("studentId", params.studentId);
  search.set("week", params.week ?? "current");
  return apiFetch<ParentReport>(`/parent/report?${search.toString()}`, { signal });
}

export function parentChildrenQueryOptions() {
  return queryOptions({
    queryKey: ["parent", "children"] as const,
    queryFn: ({ signal }) => getParentChildren(signal),
    staleTime: 30_000,
    retry: 1,
  });
}

export function parentReportQueryOptions(params: { studentId?: string; week?: string } = {}) {
  return queryOptions({
    queryKey: ["parent", "report", params] as const,
    queryFn: ({ signal }) => getParentReport(params, signal),
    staleTime: 30_000,
    retry: 1,
  });
}
