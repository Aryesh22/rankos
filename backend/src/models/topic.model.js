import mongoose from "mongoose";

/**
 * Topic model — a per-user node in the knowledge/mastery graph for a subject.
 * `key` is a short stable slug (e.g. "rot"), `x`/`y` position the node in the
 * graph view and `links` reference other topic keys. Mirrors the frontend
 * `Topic` type (see src/types/index.ts).
 */
const topicSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    key: { type: String }, // e.g. "rot"
    name: { type: String, required: true },
    subject: { type: String, required: true },
    mastery: { type: Number, default: 0 },
    lastRevisedAt: { type: Date, default: null },
    weakQuestions: { type: Number, default: 0 },
    x: { type: Number },
    y: { type: Number },
    links: { type: [String], default: [] },
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

topicSchema.index({ user: 1, subject: 1 });

export const Topic = mongoose.models.Topic || mongoose.model("Topic", topicSchema);

export default Topic;
