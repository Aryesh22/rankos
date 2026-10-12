import mongoose from "mongoose";

/**
 * StudyTask model — a single scheduled study task for a user on a given day.
 * `date` is a "YYYY-MM-DD" string and `time` an optional human label. Mirrors
 * the frontend `StudyTask` type (see src/types/index.ts).
 */
const studyTaskSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    date: { type: String }, // "YYYY-MM-DD"
    title: { type: String, required: true },
    subject: { type: String },
    minutes: { type: Number, default: 0 },
    type: {
      type: String,
      enum: ["Concept", "Practice", "Revision", "Mock", "Analysis"],
      default: "Concept",
    },
    done: { type: Boolean, default: false },
    time: { type: String, default: null },
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

studyTaskSchema.index({ user: 1, date: 1 });

export const StudyTask = mongoose.models.StudyTask || mongoose.model("StudyTask", studyTaskSchema);

export default StudyTask;
