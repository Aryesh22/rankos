import mongoose from "mongoose";

/**
 * Test model — a mock/practice test definition. Catalog-ish, but custom tests
 * created by a student carry an `owner` ref (null for platform tests).
 * `scheduledFor` is a human label (e.g. "Today, 20:00"). Mirrors the frontend
 * `Test` type (see src/types/index.ts).
 */
const testSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    exam: { type: String },
    subjects: { type: [String], default: [] },
    questions: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Question" },
    ],
    questionCount: { type: Number, default: 0 },
    durationMin: { type: Number, required: true },
    maxScore: { type: Number, required: true },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      default: "Medium",
    },
    scheduledFor: { type: String, default: null }, // human label, e.g. "Today, 20:00"
    isCustom: { type: Boolean, default: false },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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
        return ret;
      },
    },
  },
);

export const Test = mongoose.models.Test || mongoose.model("Test", testSchema);

export default Test;
