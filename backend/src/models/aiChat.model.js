import mongoose from "mongoose";

/**
 * AIChat model — a per-user conversation with the AI mentor. Each message keeps
 * its role, text, optional grounding references and timestamp. Message subdocs
 * keep their own `_id`. Mirrors the frontend `AIChat` type (see
 * src/types/index.ts).
 */
const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "ai"] },
    text: { type: String },
    groundingRefs: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const aiChatSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, default: "New chat" },
    messages: { type: [messageSchema], default: [] },
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

aiChatSchema.index({ user: 1, updatedAt: -1 });

export const AIChat = mongoose.models.AIChat || mongoose.model("AIChat", aiChatSchema);

export default AIChat;
