import bcrypt from "bcrypt";
import { env } from "../config/env.js";

/**
 * Password hashing utility (bcrypt). Salt rounds are configurable via
 * BCRYPT_SALT_ROUNDS (default 12). bcrypt generates and stores a per-password
 * salt inside the hash string, so no separate salt column is needed.
 */

/**
 * Hash a plaintext password.
 * @param {string} plainPassword
 * @returns {Promise<string>} bcrypt hash
 */
export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, env.auth.bcryptRounds);
}

/**
 * Constant-time comparison of a plaintext password against a stored hash.
 * Returns false (never throws) if the hash is missing/malformed.
 * @param {string} plainPassword
 * @param {string} passwordHash
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(plainPassword, passwordHash) {
  if (!plainPassword || !passwordHash) return false;
  try {
    return await bcrypt.compare(plainPassword, passwordHash);
  } catch {
    return false;
  }
}

export default { hashPassword, verifyPassword };
