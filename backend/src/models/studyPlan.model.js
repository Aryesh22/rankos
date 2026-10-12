import mongoose from "mongoose";

/**
 * StudyPlan model — a weekly/monthly study plan for a user, made up of dated
 * days each carrying a load value and a list of planned items. `periodStart` and
 * per-day `date` are "YYYY-MM-DD" strings. Mirrors the frontend `StudyPlan` type
 * (see src/types/index.ts).
 */
const planItemSchema = new mongoose.Schema(
  {
    title: { type: String },
    subject: { type: String },
    minutes: { type: Number },
    type: { type: String },
  },
  { _id: false },
);

const planDaySchema = new mongoose.Schema(
  {
    date: { type: String }, // "YYYY-MM-DD"
    load: { type: Number },
    items: { type: [planItemSchema], default: [] },
  },
  { _id: false },
);

const studyPlanSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    scope: {
      type: String,
      enum: ["week", "month"],
      default: "week",
    },
    periodStart: { type: String }, // "YYYY-MM-DD"
    days: { type: [planDaySchema], default: [] },
    // AI-generated roadmap narrative explaining the plan's strategy (see ai/).
    narrative: { type: String, default: null },
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

studyPlanSchema.index({ user: 1, scope: 1, periodStart: 1 });

export const StudyPlan = mongoose.models.StudyPlan || mongoose.model("StudyPlan", studyPlanSchema);

export default StudyPlan;
