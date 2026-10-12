import { User } from "../models/user.model.js";

/**
 * User repository — the ONLY place that talks to the User collection.
 *
 * Every method accepts an optional Mongoose `session` so callers can compose
 * them inside a transaction. Soft-deleted users (`deletedAt != null`) are
 * excluded from all reads by default.
 */

const notDeleted = { deletedAt: null };

/** Apply a session to a query builder only when one is provided. */
function withSession(query, session) {
  return session ? query.session(session) : query;
}

export const userRepository = {
  /**
   * Create a user.
   * @param {object} data
   * @param {import("mongoose").ClientSession|null} [session]
   * @returns {Promise<import("mongoose").HydratedDocument<any>>}
   */
  async create(data, session = null) {
    // create() with a session requires the array form.
    const [user] = await User.create([data], session ? { session } : {});
    return user;
  },

  /** Find an active user by id. */
  async findById(id, session = null) {
    return withSession(User.findOne({ _id: id, ...notDeleted }), session);
  },

  /** Find an active user by email, INCLUDING the password hash (for login). */
  async findByEmailWithPassword(email, session = null) {
    return withSession(
      User.findOne({ email: email.toLowerCase(), ...notDeleted }).select("+passwordHash"),
      session,
    );
  },

  /** Find an active user by id, INCLUDING the password hash (for change-password). */
  async findByIdWithPassword(id, session = null) {
    return withSession(
      User.findOne({ _id: id, ...notDeleted }).select("+passwordHash"),
      session,
    );
  },

  /** Find an active user by email. */
  async findByEmail(email, session = null) {
    return withSession(User.findOne({ email: email.toLowerCase(), ...notDeleted }), session);
  },

  /** Find an active user by mobile number. */
  async findByMobile(mobile, session = null) {
    return withSession(User.findOne({ mobile, ...notDeleted }), session);
  },

  /**
   * Find an active user by email OR mobile (login `identifier`), INCLUDING the
   * password hash. An identifier containing "@" is treated as an email.
   */
  async findByIdentifierWithPassword(identifier, session = null) {
    const id = String(identifier).trim();
    const match = id.includes("@") ? { email: id.toLowerCase() } : { mobile: id };
    return withSession(
      User.findOne({ ...match, ...notDeleted }).select("+passwordHash"),
      session,
    );
  },

  /** Find an active user by a linked OAuth provider identity. */
  async findByProvider(provider, providerId, session = null) {
    return withSession(
      User.findOne({
        authProviders: { $elemMatch: { provider, providerId } },
        ...notDeleted,
      }),
      session,
    );
  },

  /** True if an active user already uses this mobile number. */
  async existsByMobile(mobile, session = null) {
    const doc = await withSession(
      User.findOne({ mobile, ...notDeleted }).select("_id"),
      session,
    );
    return Boolean(doc);
  },

  /** Mark the user's mobile as verified. */
  async markMobileVerified(id, session = null) {
    return withSession(
      User.findOneAndUpdate({ _id: id, ...notDeleted }, { isMobileVerified: true }, { new: true }),
      session,
    );
  },

  /** Link (idempotently) an OAuth provider identity to a user. */
  async addAuthProvider(id, provider, session = null) {
    return withSession(
      User.findOneAndUpdate(
        { _id: id, ...notDeleted },
        { $addToSet: { authProviders: provider } },
        { new: true },
      ),
      session,
    );
  },

  /** True if an active user already uses this email. */
  async existsByEmail(email, session = null) {
    const doc = await withSession(
      User.findOne({ email: email.toLowerCase(), ...notDeleted }).select("_id"),
      session,
    );
    return Boolean(doc);
  },

  /** True if an active user already uses this username. */
  async existsByUsername(username, session = null) {
    const doc = await withSession(
      User.findOne({ username, ...notDeleted }).select("_id"),
      session,
    );
    return Boolean(doc);
  },

  /**
   * True if the username is taken by a DIFFERENT active user (for profile updates).
   */
  async isUsernameTakenByOther(username, excludeUserId, session = null) {
    const doc = await withSession(
      User.findOne({ username, _id: { $ne: excludeUserId }, ...notDeleted }).select("_id"),
      session,
    );
    return Boolean(doc);
  },

  /** Patch arbitrary fields on a user and return the updated doc. */
  async updateById(id, update, session = null) {
    return withSession(
      User.findOneAndUpdate({ _id: id, ...notDeleted }, update, { new: true, runValidators: true }),
      session,
    );
  },

  /** Update the password hash. */
  async updatePassword(id, passwordHash, session = null) {
    return withSession(
      User.findOneAndUpdate({ _id: id, ...notDeleted }, { passwordHash }, { new: true }),
      session,
    );
  },

  /** Mark the user's email as verified. */
  async markEmailVerified(id, session = null) {
    return withSession(
      User.findOneAndUpdate({ _id: id, ...notDeleted }, { isEmailVerified: true }, { new: true }),
      session,
    );
  },

  /** Record a successful login timestamp (best-effort, no session needed). */
  async touchLastLogin(id) {
    return User.updateOne({ _id: id }, { lastLoginAt: new Date() });
  },

  /** Soft delete: set deletedAt + deactivate. */
  async softDelete(id, session = null) {
    return withSession(
      User.findOneAndUpdate(
        { _id: id, ...notDeleted },
        { deletedAt: new Date(), isActive: false },
        { new: true },
      ),
      session,
    );
  },
};

export default userRepository;
