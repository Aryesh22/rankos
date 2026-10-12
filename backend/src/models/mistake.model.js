import mongoose from "mongoose";

/**
 * Mistake model — an entry in the student's "mistake notebook". Categorizes the
 * error, tracks revision status and schedules the next spaced revision.
 * `occurredOn` is a human label (e.g. "12 Jul"). Mirrors the frontend `Mistake`
 * type (see src/types/index.ts).
 */
const mistakeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    question: { type: String, required: true },
    subject: { type: String, required: true },
    chapter: { type: String },
    category: {
      type: String,
      enum: [
        "Concept Error",
        "Formula Error",
        "Calculation Error",
        "Guess",
        "Memory Error",
        "Time Pressure",
        "Careless Mistake",
      ],
      required: true,
    },
    priority: {
      type: String,
      enum: ["High", "Medium", "Low"],
      default: "Medium",
    },
    status: {
      type: String,
      enum: ["Pending", "Revised", "Mastered"],
      default: "Pending",
      index: true,
    },
    occurredOn: { type: String }, // human label, e.g. "12 Jul"
    timesRepeated: { type: Number, default: 1 },
    aiNote: { type: String, default: "" },
    nextRevisionAt: { type: Date, default: null },
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

mistakeSchema.index({ user: 1, status: 1, category: 1 });
mistakeSchema.index({ question: "text", chapter: "text" });

export const Mistake = mongoose.models.Mistake || mongoose.model("Mistake", mistakeSchema);

export default Mistake;
