/**
 * Central barrel of React Query `queryOptions` for every `/app` domain, in the
 * spirit of `sessionQueryOptions()` in `lib/auth.ts`. Import these from routes
 * so cache keys and fetchers stay consistent across pages.
 */
export { dashboardQueryOptions } from "@/services/dashboard";
export { tasksQueryOptions } from "@/services/tasks";
export { mistakesQueryOptions } from "@/services/mistakes";
export { leaderboardQueryOptions } from "@/services/leaderboard";
export {
  upcomingTestsQueryOptions,
  testHistoryQueryOptions,
  testStatsQueryOptions,
  testMetaQueryOptions,
  attemptResultQueryOptions,
} from "@/services/tests";
export { profileQueryOptions, achievementsQueryOptions } from "@/services/profile";
export {
  heatmapQueryOptions,
  examDnaQueryOptions,
  recommendationsQueryOptions,
} from "@/services/analytics";
export {
  topicGraphQueryOptions,
  topicRevisionsQueryOptions,
  topicNotesQueryOptions,
} from "@/services/topics";
export { weekPlanQueryOptions, monthPlanQueryOptions } from "@/services/plans";
export { settingsQueryOptions } from "@/services/settings";
export { notificationSettingsQueryOptions } from "@/services/notifications";
export { mentorMessagesQueryOptions } from "@/services/mentor";
export { parentChildrenQueryOptions, parentReportQueryOptions } from "@/services/parent";
export {
  teacherOverviewQueryOptions,
  teacherBatchesQueryOptions,
  teacherAssignmentsQueryOptions,
  teacherLeaderboardQueryOptions,
} from "@/services/teacher";
