import mongoose from "mongoose";

/**
 * EmailVerificationToken — one-time token backing the email-verification link.
 * Only the SHA-256 `tokenHash` is stored; the raw token lives only in the email.
 * TTL index auto-expires stale tokens. `usedAt` marks single-use consumption.
 */
const emailVerificationTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      index: true,
    },
    usedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

emailVerificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EmailVerificationToken =
  mongoose.models.EmailVerificationToken ||
  mongoose.model("EmailVerificationToken", emailVerificationTokenSchema);

export default EmailVerificationToken;
