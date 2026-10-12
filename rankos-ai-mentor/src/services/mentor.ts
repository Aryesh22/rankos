/**
 * AI Mentor Dock API surface — `GET /mentor/messages`, `POST /mentor/chat`
 * (see API_SPEC.md → "Global widget: AI Mentor Dock"). Typed `apiFetch`
 * wrappers + React Query `queryOptions`.
 */
import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface MentorMessage {
  role: "ai" | "user";
  text: string;
  groundingRefs?: string[];
}

export interface MentorMessagesResponse {
  conversationId: string;
  data: MentorMessage[];
}

export interface MentorChatResponse {
  conversationId: string;
  reply: MentorMessage;
}

export function getMentorMessages(conversationId?: string, signal?: AbortSignal): Promise<MentorMessagesResponse> {
  const qs = conversationId ? `?${new URLSearchParams({ conversationId }).toString()}` : "";
  return apiFetch<MentorMessagesResponse>(`/mentor/messages${qs}`, { signal });
}

export function sendMentorChat(input: { conversationId: string | null; text: string }): Promise<MentorChatResponse> {
  return apiFetch<MentorChatResponse>("/mentor/chat", { method: "POST", body: { ...input } });
}

export function mentorMessagesQueryOptions(enabled: boolean) {
  return queryOptions({
    queryKey: ["mentor", "messages"] as const,
    queryFn: ({ signal }) => getMentorMessages(undefined, signal),
    enabled,
    staleTime: 30_000,
    retry: 1,
  });
}
