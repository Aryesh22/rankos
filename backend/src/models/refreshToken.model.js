import mongoose from "mongoose";

/**
 * RefreshToken model — server-side record of every issued refresh token.
 *
 * - `jti` is the token's unique id (also embedded in the JWT). Lookups happen by jti.
 * - `tokenHash` is the SHA-256 of the raw JWT string; the raw token is NEVER stored,
 *   so a DB leak can't be replayed.
 * - Rotation: on refresh we set `revokedAt` + `replacedByJti` on the old record and
 *   create a new one. Reuse of an already-revoked token signals theft → revoke all.
 * - `expiresAt` has a TTL index so expired records are auto-purged by MongoDB.
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    jti: {
      type: String,
      required: true,
      unique: true,
    },
    tokenHash: {
      type: String,
      required: true,
    },
    userAgent: { type: String, default: null },
    ip: { type: String, default: null },
    revokedAt: { type: Date, default: null },
    replacedByJti: { type: String, default: null },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

// TTL index — MongoDB removes the document once `expiresAt` passes.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/** Convenience virtual: is this token currently usable? */
refreshTokenSchema.virtual("isActive").get(function isActive() {
  return !this.revokedAt && this.expiresAt.getTime() > Date.now();
});

export const RefreshToken =
  mongoose.models.RefreshToken || mongoose.model("RefreshToken", refreshTokenSchema);

export default RefreshToken;
