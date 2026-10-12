import mongoose from "mongoose";

/**
 * Subject model — a catalog entry for an exam subject (e.g. "Physics").
 * Catalog data, so it carries no `user` ref. `order` drives display sequencing
 * within an exam. Mirrors the frontend `Subject` type (see src/types/index.ts).
 */
const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    exam: { type: String },
    color: { type: String, default: null },
    order: { type: Number, default: 0 },
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

subjectSchema.index({ exam: 1, order: 1 });

export const Subject = mongoose.models.Subject || mongoose.model("Subject", subjectSchema);

export default Subject;
