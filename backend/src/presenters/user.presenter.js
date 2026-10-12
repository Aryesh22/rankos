import { examLabelFor } from "../utils/exam.util.js";

/**
 * Serialize a User (+ optional Profile) into the exact shape the frontend's
 * `GET /api/auth/me` expects (see `src/types/index.ts` → `User`). Field names
 * and types must match precisely — the client drops this straight into its
 * session cache and route guards.
 */
export function presentAuthUser(user, profile = null) {
  const exam = profile?.exam ?? user.exam ?? null;
  return {
    id: String(user._id),
    role: user.role,
    name: user.fullName,
    initials: user.initials,
    email: user.email ?? "",
    exam,
    examLabel: profile?.examLabel ?? examLabelFor(exam) ?? "",
    institute: profile?.institute ?? user.institute ?? undefined,
    state: profile?.state ?? user.state ?? undefined,
    streak: profile?.streak ?? 0,
  };
}

export default { presentAuthUser };
