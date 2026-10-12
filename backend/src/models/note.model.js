import mongoose from "mongoose";

/**
 * Note model — AI-generated revision notes for a topic (Day 2 AI feature). Each
 * note is tied to a user + topic key and stores the generated markdown content
 * plus which AI provider produced it. History is kept (newest first).
 */
const noteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    topicKey: { type: String, required: true },
    subject: { type: String, default: null },
    title: { type: String, required: true },
    content: { type: String, required: true },
    provider: { type: String, default: "local" },
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

noteSchema.index({ user: 1, topicKey: 1, createdAt: -1 });

export const Note = mongoose.models.Note || mongoose.model("Note", noteSchema);

export default Note;
