import mongoose from "mongoose";
import { ROLE_VALUES, ROLES } from "../constants/roles.js";

/**
 * User model.
 *
 * Identity is flexible to match the frontend contract (API_SPEC → PART A):
 * a user may sign up with a **mobile** number (SMS OTP), an **email**, or an
 * **OAuth provider** (Google/Apple). Consequently `email`, `username`, `mobile`
 * and `passwordHash` are all OPTIONAL at the schema level — the auth *service*
 * enforces which combination is required for each flow.
 *
 * - `passwordHash` uses `select: false` so it is never returned by default;
 *   queries that need it must `.select("+passwordHash")`. OAuth-only users have
 *   no password hash at all.
 * - Soft delete via `deletedAt`. Uniqueness on email/username/mobile is enforced
 *   with PARTIAL indexes scoped to non-deleted docs that actually have the field,
 *   so (a) a deleted user's identifiers can be reused and (b) many users may
 *   share a "missing" identifier without colliding.
 * - `toJSON` strips sensitive/internal fields.
 */
const authProviderSchema = new mongoose.Schema(
  {
    provider: { type: String, enum: ["google", "apple"], required: true },
    providerId: { type: String, required: true },
    email: { type: String, default: null },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },
    username: {
      type: String,
      trim: true,
      default: null,
    },
    mobile: {
      type: String,
      trim: true,
      default: null,
    },
    passwordHash: {
      type: String,
      select: false,
      default: null,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ROLE_VALUES,
      default: ROLES.STUDENT,
      index: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isMobileVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    // Linked social identities (upserted during OAuth).
    authProviders: {
      type: [authProviderSchema],
      default: [],
    },
    // Optional RankOS profile fields (editable via PATCH /users/me).
    exam: { type: String, default: null },
    institute: { type: String, default: null },
    state: { type: String, default: null },
    avatarUrl: { type: String, default: null },
    // Soft-delete marker. null = active account.
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.passwordHash;
        delete ret.deletedAt;
        return ret;
      },
    },
  },
);

// Partial unique indexes: uniqueness applies only to non-deleted users that
// actually carry the identifier (so multiple "null" values never collide).
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null, email: { $type: "string" } } },
);
userSchema.index(
  { username: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null, username: { $type: "string" } } },
);
userSchema.index(
  { mobile: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null, mobile: { $type: "string" } } },
);
// Fast provider lookups during OAuth callback.
userSchema.index({ "authProviders.provider": 1, "authProviders.providerId": 1 });

/** Two-letter monogram for the avatar chip, derived from the full name. */
userSchema.virtual("initials").get(function initials() {
  const parts = String(this.fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
});

export const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
