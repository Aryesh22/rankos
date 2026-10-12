import mongoose from "mongoose";

/**
 * Achievement model — a per-user badge/achievement that may be earned over time.
 * `icon` is a short icon key (default "trophy"). Mirrors the frontend
 * `Achievement` type (see src/types/index.ts).
 */
const achievementSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    detail: { type: String, default: "" },
    icon: { type: String, default: "trophy" },
    earned: { type: Boolean, default: false },
    earnedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      },
    },
  },
);

export const Achievement =
  mongoose.models.Achievement || mongoose.model("Achievement", achievementSchema);

export default Achievement;
