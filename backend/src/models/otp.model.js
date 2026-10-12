import mongoose from "mongoose";

/**
 * OTP model — one-time 6-digit codes for mobile signup / login / step-up.
 *
 * Security model mirrors the opaque-token models: we store only the SHA-256
 * `codeHash`, never the raw code (which lives only in the SMS). Codes are
 * low-entropy, so we additionally cap verification `attempts` and auto-expire
 * via a TTL index. Only the newest un-consumed OTP per (user, purpose) is valid;
 * issuing a fresh code invalidates older ones (`consumedAt` set by the service).
 */
export const OTP_PURPOSES = Object.freeze(["signup", "login", "reset"]);

const otpSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    purpose: {
      type: String,
      enum: OTP_PURPOSES,
      required: true,
    },
    channel: {
      type: String,
      enum: ["sms", "email"],
      default: "sms",
    },
    codeHash: {
      type: String,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    consumedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

// TTL index — MongoDB removes the document once `expiresAt` passes.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Newest active code per (user, purpose) lookup.
otpSchema.index({ user: 1, purpose: 1, consumedAt: 1 });

otpSchema.virtual("isActive").get(function isActive() {
  return !this.consumedAt && this.expiresAt.getTime() > Date.now();
});

export const Otp = mongoose.models.Otp || mongoose.model("Otp", otpSchema);

export default Otp;
