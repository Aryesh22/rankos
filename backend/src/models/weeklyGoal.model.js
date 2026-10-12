import mongoose from "mongoose";

/**
 * WeeklyGoal model — a per-user goal for a given week (`weekStart` is a
 * "YYYY-MM-DD" string), tracking `current` progress toward `target` in `unit`.
 * Mirrors the frontend `WeeklyGoal` type (see src/types/index.ts).
 */
const weeklyGoalSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    weekStart: { type: String }, // "YYYY-MM-DD"
    label: { type: String, required: true },
    current: { type: Number, default: 0 },
    target: { type: Number, default: 0 },
    unit: { type: String, default: "" },
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

weeklyGoalSchema.index({ user: 1, weekStart: 1 });

export const WeeklyGoal =
  mongoose.models.WeeklyGoal || mongoose.model("WeeklyGoal", weeklyGoalSchema);

export default WeeklyGoal;
