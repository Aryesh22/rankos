import { ApiError } from "../utils/ApiError.js";
import { verifyPassword } from "../utils/password.util.js";
import { userRepository } from "../repositories/user.repository.js";
import { profileRepository } from "../repositories/profile.repository.js";
import { refreshTokenRepository } from "../repositories/refreshToken.repository.js";
import { Profile } from "../models/index.js";

/**
 * Settings service — settings groups (notifications/privacy/security) + account
 * (name/email/language) and account deletion (API_SPEC.md → Page `/app/settings`).
 * Groups are stored on `Profile.preferences`; account name/email mirror the User.
 */

const DEFAULTS = Object.freeze({
  notifications: {
    dailyPlanReminder: true,
    testReminders: true,
    mistakeBankDigest: true,
    leaderboardMovement: false,
  },
  privacy: {
    shareProgressWithParents: true,
    appearOnPublicLeaderboards: true,
    allowAnonymisedBenchmarking: true,
  },
  security: {
    twoFactorAuth: false,
    examLockdownMode: true,
    sessionAlerts: true,
  },
  language: "English (India)",
});

function buildSettings(user, preferences = {}) {
  return {
    notifications: { ...DEFAULTS.notifications, ...(preferences.notifications || {}) },
    privacy: { ...DEFAULTS.privacy, ...(preferences.privacy || {}) },
    security: { ...DEFAULTS.security, ...(preferences.security || {}) },
    account: {
      fullName: user.fullName,
      email: user.email ?? "",
      language: preferences.language ?? DEFAULTS.language,
    },
  };
}

/** GET /settings → merged settings for the current user. */
export async function getSettings(userId) {
  const user = await userRepository.findById(userId);
  if (!user) throw ApiError.notFound("User not found");
  const profile = await Profile.findOne({ user: userId });
  return buildSettings(user, profile?.preferences || {});
}

/** PATCH /settings → partial update of any subset of groups; returns full settings. */
export async function updateSettings(userId, body = {}) {
  const profile = await profileRepository.ensureForUser(userId);
  const prefs = { ...(profile.preferences || {}) };

  if (body.notifications) prefs.notifications = { ...(prefs.notifications || {}), ...body.notifications };
  if (body.privacy) prefs.privacy = { ...(prefs.privacy || {}), ...body.privacy };
  if (body.security) prefs.security = { ...(prefs.security || {}), ...body.security };
  if (body.account?.language != null) prefs.language = body.account.language;

  await Profile.updateOne({ user: userId }, { preferences: prefs });

  if (body.account) {
    const upd = {};
    if (body.account.fullName != null) upd.fullName = body.account.fullName;
    if (body.account.email != null) upd.email = body.account.email;
    if (Object.keys(upd).length) await userRepository.updateById(userId, upd);
  }

  return getSettings(userId);
}

/** POST /settings/security/2fa { enable } → persist the flag (stub). */
export async function setTwoFactor(userId, enable) {
  const profile = await profileRepository.ensureForUser(userId);
  const prefs = { ...(profile.preferences || {}) };
  prefs.security = { ...(prefs.security || {}), twoFactorAuth: Boolean(enable) };
  await Profile.updateOne({ user: userId }, { preferences: prefs });
  return { enabled: Boolean(enable) };
}

/** DELETE /account { confirm, password } → verify + soft-delete + revoke sessions. */
export async function deleteAccount(userId, { confirm, password } = {}) {
  if (confirm !== "DELETE") {
    throw ApiError.badRequest("Type DELETE to confirm account deletion.", {
      fields: { confirm: 'Please type "DELETE" to confirm.' },
    });
  }
  const user = await userRepository.findByIdWithPassword(userId);
  if (!user) throw ApiError.notFound("User not found");
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    throw ApiError.unauthorized("Incorrect password.", {
      fields: { password: "Incorrect password." },
    });
  }

  await userRepository.softDelete(userId);
  await refreshTokenRepository.revokeAllForUser(userId);

  return { scheduledDeletionAt: new Date(Date.now() + 30 * 86400000).toISOString() };
}

export default { getSettings, updateSettings, setTwoFactor, deleteAccount };
