import mongoose from "mongoose";

/**
 * Profile model — the student's RankOS learning profile & gamification state.
 * One-to-one with User (separate collection to keep the auth document lean and
 * to normalize the ever-growing set of learning/stat fields). Mirrors the
 * `student` object the frontend dashboard consumes (see mockData.ts / API_SPEC).
 */
const profileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    exam: { type: String, default: null }, // e.g. "JEE"
    examLabel: { type: String, default: null }, // e.g. "JEE Advanced 2027"
    targetYear: { type: Number, default: null },
    dreamCollege: { type: String, default: null },
    institute: { type: String, default: null },
    state: { type: String, default: null },

    // Rank targets
    targetRank: { type: Number, default: null },
    currentPredictedRank: { type: Number, default: null },

    // Gamification
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    streak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastActiveOn: { type: Date, default: null },

    // Rolling stats
    hoursThisWeek: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0 },
    syllabusCovered: { type: Number, default: 0 },

    // Personal + notification settings (PATCH /users/me/settings)
    settings: {
      emailNotifications: { type: Boolean, default: true },
      pushNotifications: { type: Boolean, default: true },
      weeklyDigest: { type: Boolean, default: true },
      theme: { type: String, enum: ["light", "dark", "system"], default: "system" },
    },

    // Free-form settings groups (notifications/privacy/security/language) backing
    // GET/PATCH /api/settings — see API_SPEC.md → Settings page.
    preferences: { type: mongoose.Schema.Types.Mixed, default: {} },
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

export const Profile = mongoose.models.Profile || mongoose.model("Profile", profileSchema);

export default Profile;
