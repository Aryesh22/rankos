import mongoose from "mongoose";

/**
 * LeaderboardEntry model — a ranked entry within a leaderboard `scope`
 * (india/state/institute/friends) and `range` (weekly/monthly/overall). May be
 * backed by a real `user` or be a synthetic/aggregate row (user null). Mirrors
 * the frontend `LeaderboardEntry` type (see src/types/index.ts).
 */
const leaderboardEntrySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    name: { type: String, required: true },
    institute: { type: String, default: "" },
    state: { type: String, default: "" },
    xp: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    scope: {
      type: String,
      enum: ["india", "state", "institute", "friends"],
      default: "india",
    },
    range: {
      type: String,
      enum: ["weekly", "monthly", "overall"],
      default: "weekly",
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
        return ret;
      },
    },
  },
);

leaderboardEntrySchema.index({ scope: 1, range: 1, xp: -1 });

export const LeaderboardEntry =
  mongoose.models.LeaderboardEntry ||
  mongoose.model("LeaderboardEntry", leaderboardEntrySchema);

export default LeaderboardEntry;
