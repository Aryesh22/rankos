import { Profile } from "../models/profile.model.js";

/**
 * Profile repository — sole gateway to the Profile collection.
 */
function withSession(query, session) {
  return session ? query.session(session) : query;
}

export const profileRepository = {
  async create(data, session = null) {
    const [doc] = await Profile.create([data], session ? { session } : {});
    return doc;
  },

  async findByUser(user, session = null) {
    return withSession(Profile.findOne({ user }), session);
  },

  async updateByUser(user, update, session = null) {
    return withSession(
      Profile.findOneAndUpdate({ user }, update, { new: true, runValidators: true }),
      session,
    );
  },

  /** Upsert-style: return existing or create with defaults. */
  async ensureForUser(user, defaults = {}, session = null) {
    const existing = await this.findByUser(user, session);
    if (existing) return existing;
    return this.create({ user, ...defaults }, session);
  },
};

export default profileRepository;
