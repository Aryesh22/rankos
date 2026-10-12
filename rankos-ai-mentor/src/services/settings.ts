/**
 * Settings API surface — `GET /settings`, `PATCH /settings`
 * (see API_SPEC.md → "Page: /app/settings"). Typed `apiFetch` wrappers +
 * React Query `queryOptions`.
 */
import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface NotificationSettings {
  dailyPlanReminder: boolean;
  testReminders: boolean;
  mistakeBankDigest: boolean;
  leaderboardMovement: boolean;
}

export interface PrivacySettings {
  shareProgressWithParents: boolean;
  appearOnPublicLeaderboards: boolean;
  allowAnonymisedBenchmarking: boolean;
}

export interface SecuritySettings {
  twoFactorAuth: boolean;
  examLockdownMode: boolean;
  sessionAlerts: boolean;
}

export interface AccountSettings {
  fullName: string;
  email: string;
  language: string;
}

export interface Settings {
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  security: SecuritySettings;
  account: AccountSettings;
}

export type SettingsPatch = {
  notifications?: Partial<NotificationSettings>;
  privacy?: Partial<PrivacySettings>;
  security?: Partial<SecuritySettings>;
  account?: Partial<AccountSettings>;
};

export function getSettings(signal?: AbortSignal): Promise<Settings> {
  return apiFetch<Settings>("/settings", { signal });
}

/** Partial update of any subset of the settings groups; returns the full object. */
export function updateSettings(patch: SettingsPatch): Promise<Settings> {
  return apiFetch<Settings>("/settings", { method: "PATCH", body: patch });
}

export function settingsQueryOptions() {
  return queryOptions({
    queryKey: ["settings"] as const,
    queryFn: ({ signal }) => getSettings(signal),
    staleTime: 30_000,
    retry: 1,
  });
}
