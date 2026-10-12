import mongoose from "mongoose";

/**
 * StudyLog model — one document per user per day capturing study-activity
 * intensity (`value`, 0-5 for the heatmap) and total `minutes`. `date` is a
 * "YYYY-MM-DD" string; one entry per user/day is enforced by a compound unique
 * index. Mirrors the frontend `StudyLog` type (see src/types/index.ts).
 */
const studyLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    date: { type: String }, // "YYYY-MM-DD"
    value: { type: Number, default: 0 }, // heatmap intensity 0-5
    minutes: { type: Number, default: 0 },
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

studyLogSchema.index({ user: 1, date: 1 }, { unique: true });

export const StudyLog = mongoose.models.StudyLog || mongoose.model("StudyLog", studyLogSchema);

export default StudyLog;
