/**
 * Topics / Revision Graph API surface — `GET /topics/graph`,
 * `GET /topics/:id/revisions` (see API_SPEC.md → "Page: /app/revision-graph").
 * Typed `apiFetch` wrappers + React Query `queryOptions`.
 */
import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { TopicNode } from "@/types";

export interface TopicGraphResponse {
  nodes: TopicNode[];
}

export interface TopicRevision {
  revisedAt: string;
  masteryBefore: number;
  masteryAfter: number;
  questionsPractised: number;
}

export interface TopicRevisionsResponse {
  data: TopicRevision[];
}

export interface Note {
  id: string;
  topicKey: string;
  subject: string | null;
  title: string;
  content: string;
  provider: string;
  createdAt: string;
}

export interface TopicNotesResponse {
  data: Note[];
}

export function getTopicGraph(signal?: AbortSignal): Promise<TopicGraphResponse> {
  return apiFetch<TopicGraphResponse>("/topics/graph", { signal });
}

export function getTopicRevisions(id: string, signal?: AbortSignal): Promise<TopicRevisionsResponse> {
  return apiFetch<TopicRevisionsResponse>(`/topics/${id}/revisions`, { signal });
}

/** Spin up a targeted practice paper for a topic's weak questions. */
export function practiceTopic(id: string, count?: number): Promise<{ testId: string; code: string }> {
  return apiFetch<{ testId: string; code: string }>(`/topics/${id}/practice`, {
    method: "POST",
    body: count !== undefined ? { count } : {},
  });
}

/** Read the latest AI-generated notes for a topic. */
export function getTopicNotes(id: string, signal?: AbortSignal): Promise<TopicNotesResponse> {
  return apiFetch<TopicNotesResponse>(`/topics/${id}/notes`, { signal });
}

/** Generate a fresh AI note (markdown) for a topic. */
export function generateTopicNotes(id: string): Promise<Note> {
  return apiFetch<Note>(`/topics/${id}/notes`, { method: "POST", body: {} });
}

export function topicGraphQueryOptions() {
  return queryOptions({
    queryKey: ["topics", "graph"] as const,
    queryFn: ({ signal }) => getTopicGraph(signal),
    staleTime: 60_000,
    retry: 1,
  });
}

export function topicRevisionsQueryOptions(id: string | undefined) {
  return queryOptions({
    queryKey: ["topics", "revisions", id] as const,
    queryFn: ({ signal }) => getTopicRevisions(id as string, signal),
    enabled: Boolean(id),
    staleTime: 60_000,
    retry: 1,
  });
}

export function topicNotesQueryOptions(id: string | undefined) {
  return queryOptions({
    queryKey: ["topics", "notes", id] as const,
    queryFn: ({ signal }) => getTopicNotes(id as string, signal),
    enabled: Boolean(id),
    staleTime: 60_000,
    retry: 1,
  });
}
