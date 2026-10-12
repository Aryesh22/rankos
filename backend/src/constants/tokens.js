/** JWT token types (embedded in the `type` claim to prevent token confusion). */
export const TOKEN_TYPES = Object.freeze({
  ACCESS: "access",
  REFRESH: "refresh",
});

/** httpOnly cookie names used for the auth tokens. */
export const COOKIE_NAMES = Object.freeze({
  ACCESS: "access_token",
  REFRESH: "refresh_token",
});

export default { TOKEN_TYPES, COOKIE_NAMES };
