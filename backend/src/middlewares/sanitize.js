/**
 * Request sanitizer — dependency-free protection against NoSQL operator
 * injection and prototype pollution. It strips any key that:
 *   - starts with "$" or contains "." (Mongo query operators / dotted paths), or
 *   - is a prototype-pollution vector (__proto__ / constructor / prototype).
 *
 * String VALUES are left intact on purpose: RankOS content carries math symbols
 * (∫, θ, <, >) that blanket HTML-stripping would corrupt. Output encoding is the
 * frontend's job; this guards the query layer.
 */
const BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function scrub(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 6) return;
  if (Array.isArray(value)) {
    for (const item of value) scrub(item, depth + 1);
    return;
  }
  for (const key of Object.keys(value)) {
    if (key.startsWith("$") || key.includes(".") || BLOCKED_KEYS.has(key)) {
      delete value[key];
      continue;
    }
    scrub(value[key], depth + 1);
  }
}

export function sanitize(req, _res, next) {
  scrub(req.body);
  scrub(req.params);
  // In Express 4 `req.query` is a getter that RE-PARSES on every access, so
  // mutating the returned object doesn't stick. Capture it once, scrub it, and
  // pin the cleaned object as a fixed property so downstream reads see it.
  try {
    const q = req.query;
    scrub(q);
    Object.defineProperty(req, "query", { value: q, writable: true, configurable: true });
  } catch {
    scrub(req.query);
  }
  next();
}

export default sanitize;
