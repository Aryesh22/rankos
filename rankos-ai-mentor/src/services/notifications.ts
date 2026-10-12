/**
 * Notification-preferences API surface. Notification settings live inside the
 * `/settings` document (see API_SPEC.md → "Page: /app/settings"); this module
 * exposes a focused read/patch over just that group so notification UI can wire
 * against a single domain. Typed `apiFetch` wrappers + React Query options.
 */
import { queryOptions } from "@tanstack/react-query";
import { getSettings, updateSettings, type NotificationSettings } from "@/services/settings";

/** Read just the notification-preferences slice of the settings document. */
export async function getNotificationSettings(signal?: AbortSignal): Promise<NotificationSettings> {
  const settings = await getSettings(signal);
  return settings.notifications;
}

/** Patch only the notification-preferences slice. */
export async function updateNotificationSettings(
  patch: Partial<NotificationSettings>,
): Promise<NotificationSettings> {
  const settings = await updateSettings({ notifications: patch });
  return settings.notifications;
}

export function notificationSettingsQueryOptions() {
  return queryOptions({
    queryKey: ["settings", "notifications"] as const,
    queryFn: ({ signal }) => getNotificationSettings(signal),
    staleTime: 30_000,
    retry: 1,
  });
}

export type { NotificationSettings };
