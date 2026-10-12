import { Otp } from "../models/otp.model.js";

/**
 * OTP repository — the ONLY place that talks to the Otp collection.
 * Every method accepts an optional Mongoose session for transactional use.
 */
function withSession(query, session) {
  return session ? query.session(session) : query;
}

export const otpRepository = {
  /** Create a new OTP record. */
  async create(data, session = null) {
    const [otp] = await Otp.create([data], session ? { session } : {});
    return otp;
  },

  /** Newest still-valid (un-consumed, un-expired) OTP for a (user, purpose). */
  async findLatestActive(user, purpose, session = null) {
    return withSession(
      Otp.findOne({
        user,
        purpose,
        consumedAt: null,
        expiresAt: { $gt: new Date() },
      }).sort({ createdAt: -1 }),
      session,
    );
  },

  /** Increment the failed-attempt counter and return the updated doc. */
  async incrementAttempts(id, session = null) {
    return withSession(
      Otp.findByIdAndUpdate(id, { $inc: { attempts: 1 } }, { new: true }),
      session,
    );
  },

  /** Mark a specific OTP as consumed (single-use). */
  async consume(id, session = null) {
    return withSession(
      Otp.findByIdAndUpdate(id, { consumedAt: new Date() }, { new: true }),
      session,
    );
  },

  /** Invalidate every active OTP for a (user, purpose) — used before re-issuing. */
  async consumeAllActive(user, purpose, session = null) {
    const q = Otp.updateMany(
      { user, purpose, consumedAt: null },
      { consumedAt: new Date() },
    );
    return session ? q.session(session) : q;
  },
};

export default otpRepository;
