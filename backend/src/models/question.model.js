import mongoose from "mongoose";

/**
 * Question model — a catalog multiple-choice question. Catalog data, so it has
 * no `user` ref. `correctIndex` points into `options`. Mirrors the frontend
 * `Question` type (see src/types/index.ts).
 */
const questionSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true },
    topic: { type: String, default: null },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      default: "Medium",
    },
    text: { type: String, required: true },
    options: { type: [String], required: true },
    correctIndex: { type: Number, required: true },
    tags: { type: [String], default: [] },
    source: { type: String, default: null },
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

questionSchema.index({ subject: 1, difficulty: 1 });

export const Question = mongoose.models.Question || mongoose.model("Question", questionSchema);

export default Question;
