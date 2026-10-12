import mongoose from "mongoose";

/**
 * Revision model — a log entry recording a spaced-revision session for a topic.
 * `topicKey` matches `Topic.key`. Captures mastery before/after and questions
 * practised. Mirrors the frontend `Revision` type (see src/types/index.ts).
 */
const revisionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    topicKey: { type: String }, // matches Topic.key
    revisedAt: { type: Date, default: Date.now },
    masteryBefore: { type: Number },
    masteryAfter: { type: Number },
    questionsPractised: { type: Number, default: 0 },
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

revisionSchema.index({ user: 1, topicKey: 1, revisedAt: -1 });

export const Revision = mongoose.models.Revision || mongoose.model("Revision", revisionSchema);

export default Revision;
