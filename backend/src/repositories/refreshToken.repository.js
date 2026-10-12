import { RefreshToken } from "../models/refreshToken.model.js";

/**
 * RefreshToken repository — server-side session records. A session IS a refresh
 * token: created on login/verify, rotated on refresh, revoked on logout.
 */
function withSession(query, session) {
  return session ? query.session(session) : query;
}

export const refreshTokenRepository = {
  /** Persist a newly-issued refresh token. */
  async create(data, session = null) {
    const [doc] = await RefreshToken.create([data], session ? { session } : {});
    return doc;
  },

  /** Find a refresh token record by its jti (active or not — caller checks). */
  async findByJti(jti, session = null) {
    return withSession(RefreshToken.findOne({ jti }), session);
  },

  /** Revoke a single token, optionally recording the rotation successor. */
  async revoke(jti, replacedByJti = null, session = null) {
    return withSession(
      RefreshToken.findOneAndUpdate(
        { jti, revokedAt: null },
        { revokedAt: new Date(), replacedByJti },
        { new: true },
      ),
      session,
    );
  },

  /** Revoke ALL active tokens for a user (logout-all / theft response). */
  async revokeAllForUser(user, session = null) {
    const q = RefreshToken.updateMany(
      { user, revokedAt: null },
      { revokedAt: new Date() },
    );
    return session ? q.session(session) : q;
  },
};

export default refreshTokenRepository;
