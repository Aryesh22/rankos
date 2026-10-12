import mongoose from "mongoose";

/**
 * PomodoroSession — a logged focus session from the Planner's Pomodoro timer
 * (API_SPEC.md → `POST /api/pomodoro`). `taskId` is stored as a free-form string
 * so it can reference either a StudyTask id or a client-side task key.
 */
const pomodoroSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    focusMinutes: { type: Number, default: 25 },
    taskId: { type: String, default: null },
    completed: { type: Boolean, default: true },
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

pomodoroSessionSchema.index({ user: 1, createdAt: -1 });

export const PomodoroSession =
  mongoose.models.PomodoroSession || mongoose.model("PomodoroSession", pomodoroSessionSchema);

export default PomodoroSession;
