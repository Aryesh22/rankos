/**
 * Test Centre + attempt-lifecycle API surface
 * (see API_SPEC.md → "Page: /app/tests", "/test/$testId", "/app/results").
 * Typed `apiFetch` wrappers + React Query `queryOptions`.
 */
import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { Difficulty, TestSummary } from "@/types";

export interface TestListResponse {
  data: TestSummary[];
}

export interface TestStats {
  attempted: number;
  avgAccuracy: number;
  avgTimePerQuestionSec: number;
  bestPercentile: number;
}

export interface TestMeta {
  id: string;
  code: string;
  title: string;
  durationMin: number;
  questionCount: number;
  subjects: string[];
  maxScore: number;
}

export interface AttemptQuestion {
  id: number;
  subject: string;
  difficulty: Difficulty;
  text: string;
  options: string[];
}

export interface StartAttemptResponse {
  attemptId: string;
  durationSec: number;
  questions: AttemptQuestion[];
}

export interface SaveResponseInput {
  questionId: number;
  selectedIndex?: number;
  status?: string;
  marked?: boolean;
  timeSpentSec?: number;
}

export interface SubmitAttemptResult {
  attemptId: string;
  score: number;
  maxScore: number;
  percentile: number;
  accuracy: number;
  resultUrl: string;
}

/* -------------------------------------------------------------- */
/* Result analysis                                                */
/* -------------------------------------------------------------- */

export interface AttemptTimelineCell {
  index: number;
  state: "correct" | "wrong" | "skipped" | "review";
  seconds: number;
}

export interface AttemptResult {
  score: number;
  maxScore: number;
  percentile: number;
  predictedAIR: number;
  accuracy: number;
  aiFeedback: string;
  timeline: AttemptTimelineCell[];
  timePerQuestion: { bucket: string; correct: number; wrong: number }[];
  errorMix: { name: string; key: string; value: number }[];
  subjectBreakdown: { subject: string; score: number; max: number; accuracy: number; time: number }[];
  difficultyStats: { level: string; correct: number; total: number }[];
  radar: { trait: string; value: number }[];
  weakAreas: string[];
  strongAreas: string[];
  attempted?: number;
}

/* -------------------------------------------------------------- */
/* Reads                                                          */
/* -------------------------------------------------------------- */

export function getUpcomingTests(signal?: AbortSignal): Promise<TestListResponse> {
  return apiFetch<TestListResponse>("/tests?status=upcoming", { signal });
}

export function getTestHistory(signal?: AbortSignal): Promise<TestListResponse> {
  return apiFetch<TestListResponse>("/tests?status=history", { signal });
}

export function getTestStats(signal?: AbortSignal): Promise<TestStats> {
  return apiFetch<TestStats>("/tests/stats", { signal });
}

export function getTestMeta(code: string, signal?: AbortSignal): Promise<TestMeta> {
  return apiFetch<TestMeta>(`/tests/${code}`, { signal });
}

export function getAttemptResult(attemptId: string, signal?: AbortSignal): Promise<AttemptResult> {
  return apiFetch<AttemptResult>(`/attempts/${attemptId}/result`, { signal });
}

/* -------------------------------------------------------------- */
/* Attempt lifecycle (writes)                                     */
/* -------------------------------------------------------------- */

export function startAttempt(code: string): Promise<StartAttemptResponse> {
  return apiFetch<StartAttemptResponse>(`/tests/${code}/attempts`, { method: "POST" });
}

export function saveAttemptResponse(attemptId: string, input: SaveResponseInput): Promise<{ saved: boolean }> {
  return apiFetch<{ saved: boolean }>(`/attempts/${attemptId}/response`, {
    method: "PATCH",
    body: { ...input },
  });
}

export function submitAttempt(attemptId: string, durationUsedSec: number): Promise<SubmitAttemptResult> {
  return apiFetch<SubmitAttemptResult>(`/attempts/${attemptId}/submit`, {
    method: "POST",
    body: { durationUsedSec },
  });
}

/** Generate a bespoke paper from the custom test generator. */
export function createCustomTest(input: {
  subjects: string[];
  difficulty: string;
  count: number;
}): Promise<{ testId: string; code: string; questionCount: number }> {
  return apiFetch<{ testId: string; code: string; questionCount: number }>("/tests/custom", {
    method: "POST",
    body: { ...input },
  });
}

/** Push an attempt's errors into the Mistake Bank (optionally a question subset). */
export function attemptToMistakeBank(
  attemptId: string,
  questionIds?: number[],
): Promise<{ created: number }> {
  return apiFetch<{ created: number }>(`/attempts/${attemptId}/to-mistake-bank`, {
    method: "POST",
    body: questionIds ? { questionIds } : {},
  });
}

/** Schedule spaced-revision tasks for an attempt's weak topics. */
export function attemptScheduleRevision(
  attemptId: string,
  topicIds: string[],
): Promise<{ tasksCreated: number }> {
  return apiFetch<{ tasksCreated: number }>(`/attempts/${attemptId}/schedule-revision`, {
    method: "POST",
    body: { topicIds },
  });
}

/* -------------------------------------------------------------- */
/* Query options                                                  */
/* -------------------------------------------------------------- */

export function upcomingTestsQueryOptions() {
  return queryOptions({
    queryKey: ["tests", "upcoming"] as const,
    queryFn: ({ signal }) => getUpcomingTests(signal),
    staleTime: 30_000,
    retry: 1,
  });
}

export function testHistoryQueryOptions() {
  return queryOptions({
    queryKey: ["tests", "history"] as const,
    queryFn: ({ signal }) => getTestHistory(signal),
    staleTime: 30_000,
    retry: 1,
  });
}

export function testStatsQueryOptions() {
  return queryOptions({
    queryKey: ["tests", "stats"] as const,
    queryFn: ({ signal }) => getTestStats(signal),
    staleTime: 30_000,
    retry: 1,
  });
}

export function testMetaQueryOptions(code: string) {
  return queryOptions({
    queryKey: ["test-meta", code] as const,
    queryFn: ({ signal }) => getTestMeta(code, signal),
    staleTime: 60_000,
    retry: 1,
  });
}

export function attemptResultQueryOptions(attemptId: string | undefined) {
  return queryOptions({
    queryKey: ["attempt-result", attemptId] as const,
    queryFn: ({ signal }) => getAttemptResult(attemptId as string, signal),
    enabled: Boolean(attemptId),
    staleTime: 60_000,
    retry: 1,
  });
}
