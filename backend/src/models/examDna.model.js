import mongoose from "mongoose";

/**
 * ExamDNA model — a per-user analytical fingerprint of exam behaviour: radar
 * traits, behaviour/error profiles, burnout risk and a narrative summary.
 * One-to-one with User. Mirrors the frontend `ExamDNA` type (see
 * src/types/index.ts).
 */
const radarSchema = new mongoose.Schema(
  {
    trait: { type: String },
    value: { type: Number },
  },
  { _id: false },
);

const labelledValueSchema = new mongoose.Schema(
  {
    key: { type: String },
    label: { type: String },
    value: { type: Number },
  },
  { _id: false },
);

const examDnaSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    radar: { type: [radarSchema], default: [] },
    behaviours: { type: [labelledValueSchema], default: [] },
    errorProfile: { type: [labelledValueSchema], default: [] },
    burnoutRisk: { type: String, default: "Low" },
    enduranceDropPct: { type: Number, default: 0 },
    learningVelocity: { type: Number, default: 0 },
    narrative: { type: String, default: "" },
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

export const ExamDNA = mongoose.models.ExamDNA || mongoose.model("ExamDNA", examDnaSchema);

export default ExamDNA;
