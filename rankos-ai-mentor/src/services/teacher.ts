/**
 * Teacher View API surface — `GET /teacher/overview`, `/teacher/batches`,
 * `/teacher/assignments`, `/teacher/leaderboard`
 * (see API_SPEC.md → "Page: /app/teacher"). Typed `apiFetch` wrappers +
 * React Query `queryOptions`.
 */
import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface TeacherOverview {
  totalStudents: number;
  avgClassAccuracy: number;
  openAssignments: number;
  batchCount: number;
}

export interface TeacherBatch {
  id: string;
  name: string;
  students: number;
  avgScore: number;
  weakTopic: string;
  trend: number;
}

export interface TeacherAssignment {
  id: string;
  title: string;
  batch: string;
  due: string;
  submitted: number;
  total: number;
}

export interface TeacherLeaderboardRow {
  rank: number;
  name: string;
  institute: string;
  accuracy: number;
}

export function getTeacherOverview(signal?: AbortSignal): Promise<TeacherOverview> {
  return apiFetch<TeacherOverview>("/teacher/overview", { signal });
}

export function getTeacherBatches(signal?: AbortSignal): Promise<{ data: TeacherBatch[] }> {
  return apiFetch<{ data: TeacherBatch[] }>("/teacher/batches", { signal });
}

export function getTeacherAssignments(signal?: AbortSignal): Promise<{ data: TeacherAssignment[] }> {
  return apiFetch<{ data: TeacherAssignment[] }>("/teacher/assignments", { signal });
}

export function getTeacherLeaderboard(limit = 6, signal?: AbortSignal): Promise<{ data: TeacherLeaderboardRow[] }> {
  const query = new URLSearchParams({ limit: String(limit) }).toString();
  return apiFetch<{ data: TeacherLeaderboardRow[] }>(`/teacher/leaderboard?${query}`, { signal });
}

export function teacherOverviewQueryOptions() {
  return queryOptions({
    queryKey: ["teacher", "overview"] as const,
    queryFn: ({ signal }) => getTeacherOverview(signal),
    staleTime: 30_000,
    retry: 1,
  });
}

export function teacherBatchesQueryOptions() {
  return queryOptions({
    queryKey: ["teacher", "batches"] as const,
    queryFn: ({ signal }) => getTeacherBatches(signal),
    staleTime: 30_000,
    retry: 1,
  });
}

export function teacherAssignmentsQueryOptions() {
  return queryOptions({
    queryKey: ["teacher", "assignments"] as const,
    queryFn: ({ signal }) => getTeacherAssignments(signal),
    staleTime: 30_000,
    retry: 1,
  });
}

export function teacherLeaderboardQueryOptions(limit = 6) {
  return queryOptions({
    queryKey: ["teacher", "leaderboard", limit] as const,
    queryFn: ({ signal }) => getTeacherLeaderboard(limit, signal),
    staleTime: 30_000,
    retry: 1,
  });
}
