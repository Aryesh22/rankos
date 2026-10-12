import mongoose from "mongoose";

/**
 * Upload model — a file the student submitted (OMR sheet, CBT screenshot, PDF,
 * or image) plus the structured data extracted from it by OCR. The raw file
 * lives in object storage (Cloudinary in production, local disk in the dev
 * stub); this document holds the metadata + parsed questions/answers.
 */
const parsedQuestionSchema = new mongoose.Schema(
  {
    questionNumber: { type: Number, default: null },
    subject: { type: String, default: null },
    topic: { type: String, default: null },
    text: { type: String, default: "" },
    options: { type: [String], default: [] },
    studentAnswer: { type: String, default: null },
    correctAnswer: { type: String, default: null },
  },
  { _id: false },
);

const uploadSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: ["pdf", "image", "omr", "cbt"],
      default: "image",
      index: true,
    },
    originalName: { type: String, default: null },
    mimeType: { type: String, default: null },
    size: { type: Number, default: 0 },
    // Storage
    provider: { type: String, enum: ["cloudinary", "local"], default: "local" },
    url: { type: String, required: true },
    publicId: { type: String, default: null },
    // OCR pipeline
    status: {
      type: String,
      enum: ["uploaded", "processing", "parsed", "failed"],
      default: "uploaded",
      index: true,
    },
    ocrProvider: { type: String, default: "stub" },
    rawText: { type: String, default: "" },
    parsed: { type: [parsedQuestionSchema], default: [] },
    error: { type: String, default: null },
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

uploadSchema.index({ user: 1, createdAt: -1 });

export const Upload = mongoose.models.Upload || mongoose.model("Upload", uploadSchema);

export default Upload;
