import mongoose from "mongoose";

/**
 * TestAttempt model — a student's attempt at a Test, tracking per-question
 * responses, scoring and analytics (percentile, predicted AIR, subject
 * breakdown). Mirrors the frontend `TestAttempt` type (see src/types/index.ts).
 */
const responseSchema = new mongoose.Schema(
  {
    questionId: { type: Number },
    selectedIndex: { type: Number, default: null },
    status: { type: String, default: "not_visited" },
    marked: { type: Boolean, default: false },
    timeSpentSec: { type: Number, default: 0 },
  },
  { _id: false },
);

const subjectBreakdownSchema = new mongoose.Schema(
  {
    subject: { type: String },
    score: { type: Number },
    max: { type: Number },
    accuracy: { type: Number },
    time: { type: Number },
  },
  { _id: false },
);

const testAttemptSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    test: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Test",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["in_progress", "submitted"],
      default: "in_progress",
    },
    responses: { type: [responseSchema], default: [] },
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    percentile: { type: Number, default: null },
    accuracy: { type: Number, default: null },
    predictedAIR: { type: Number, default: null },
    durationUsedSec: { type: Number, default: 0 },
    subjectBreakdown: { type: [subjectBreakdownSchema], default: [] },
    // AI-generated performance summary, computed once at submit (see ai/).
    aiSummary: { type: String, default: null },
    startedAt: { type: Date, default: Date.now },
    submittedAt: { type: Date, default: null },
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

testAttemptSchema.index({ user: 1, createdAt: -1 });

export const TestAttempt =
  mongoose.models.TestAttempt || mongoose.model("TestAttempt", testAttemptSchema);

export default TestAttempt;
