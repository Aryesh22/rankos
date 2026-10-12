/**
 * Analytics API surface — `GET /analytics/heatmap`, `GET /analytics/exam-dna`
 * (see API_SPEC.md → Profile / Exam DNA). Typed `apiFetch` wrappers +
 * React Query `queryOptions`.
 */
import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface HeatmapCell {
  date: string;
  value: number;
}

export interface HeatmapResponse {
  data: HeatmapCell[];
}

export interface ExamDnaChapter {
  id: string;
  name: string;
  subject: string;
  mastery: number;
}

export interface ExamDnaResponse {
  radar: { trait: string; value: number }[];
  behaviours: { key: string; label: string; value: number }[];
  errorProfile: { key: string; label: string; value: number }[];
  burnoutRisk: string;
  enduranceDropPct: number;
  learningVelocity: number;
  narrative: string;
  weakChapters: ExamDnaChapter[];
  strongChapters: ExamDnaChapter[];
}

export interface RecommendationsResponse {
  headline: string;
  items: string[];
  topics: string[];
  provider: string;
}

export function getHeatmap(days = 182, signal?: AbortSignal): Promise<HeatmapResponse> {
  const query = new URLSearchParams({ days: String(days) }).toString();
  return apiFetch<HeatmapResponse>(`/analytics/heatmap?${query}`, { signal });
}

export function getExamDna(signal?: AbortSignal): Promise<ExamDnaResponse> {
  return apiFetch<ExamDnaResponse>("/analytics/exam-dna", { signal });
}

export function getRecommendations(signal?: AbortSignal): Promise<RecommendationsResponse> {
  return apiFetch<RecommendationsResponse>("/analytics/recommendations", { signal });
}

export function heatmapQueryOptions(days = 182) {
  return queryOptions({
    queryKey: ["analytics", "heatmap", days] as const,
    queryFn: ({ signal }) => getHeatmap(days, signal),
    staleTime: 60_000,
    retry: 1,
  });
}

export function examDnaQueryOptions() {
  return queryOptions({
    queryKey: ["analytics", "exam-dna"] as const,
    queryFn: ({ signal }) => getExamDna(signal),
    staleTime: 60_000,
    retry: 1,
  });
}

export function recommendationsQueryOptions() {
  return queryOptions({
    queryKey: ["analytics", "recommendations"] as const,
    queryFn: ({ signal }) => getRecommendations(signal),
    staleTime: 60_000,
    retry: 1,
  });
}
