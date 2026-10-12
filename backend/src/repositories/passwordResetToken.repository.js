import { PasswordResetToken } from "../models/passwordResetToken.model.js";

/**
 * PasswordResetToken repository — one-time, hashed reset tokens.
 */
function withSession(query, session) {
  return session ? query.session(session) : query;
}

export const passwordResetTokenRepository = {
  async create(data, session = null) {
    const [doc] = await PasswordResetToken.create([data], session ? { session } : {});
    return doc;
  },

  /** Find an unused, unexpired token by its stored hash. */
  async findActiveByHash(tokenHash, session = null) {
    return withSession(
      PasswordResetToken.findOne({
        tokenHash,
        usedAt: null,
        expiresAt: { $gt: new Date() },
      }),
      session,
    );
  },

  /** Mark a token as consumed (single-use). */
  async consume(id, session = null) {
    return withSession(
      PasswordResetToken.findByIdAndUpdate(id, { usedAt: new Date() }, { new: true }),
      session,
    );
  },

  /** Invalidate every outstanding reset token for a user (before issuing a new one). */
  async invalidateAllForUser(user, session = null) {
    const q = PasswordResetToken.updateMany(
      { user, usedAt: null },
      { usedAt: new Date() },
    );
    return session ? q.session(session) : q;
  },
};

export default passwordResetTokenRepository;
