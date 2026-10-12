import { randomBytes, randomUUID, createHash } from "node:crypto";

/**
 * Opaque token generator for email-verification and password-reset links.
 *
 * Security model: we email the RAW token to the user but persist only its
 * SHA-256 hash. A stolen database therefore never yields usable tokens
 * (same principle as password hashing, but tokens are high-entropy so a fast
 * hash is sufficient and lets us look them up by hash in O(1)).
 */

/** SHA-256 hash of a token (hex). Used for storage + lookup. */
export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Generate a cryptographically-random opaque token and its storage hash.
 * @param {number} [bytes=32]
 * @returns {{ token: string, tokenHash: string }}
 */
export function generateOpaqueToken(bytes = 32) {
  const token = randomBytes(bytes).toString("hex");
  return { token, tokenHash: hashToken(token) };
}

/** Generate a unique identifier (used as a refresh token's `jti`). */
export function generateJti() {
  return randomUUID();
}

export default { hashToken, generateOpaqueToken, generateJti };
