# Module 4 — Worked Solutions

> Full answers to every exercise across the four chapters. Try each on your own first — the value is in the struggle, not the reading. Answers cite real files under `backend/src/`.

Jump to: [4.1 Passwords](#module-41--passwords--hashing) · [4.2 JWTs & Sessions](#module-42--jwts-cookies--sessions) · [4.3 OTPs & Reset](#module-43--otps-verification--password-reset) · [4.4 Security Mastery](#module-44--security-mastery)

---

## Module 4.1 — Passwords & Hashing

### 1. Why encrypting passwords fails

Encryption is *reversible by design* — it exists so you can get the plaintext back with a key. But to check a password at login the server must be able to reverse the stored value, so the decryption key has to live on the server, right beside the database it "protects." An attacker who compromises the server (or the backup, or the config) gets both ciphertext and key and decrypts every password. The scheme breaks at the moment you ask "where does the key live?" — there's no safe answer. The deeper point: we never *want* the plaintext back, so reversibility is a pure liability. Hashing is right precisely because it's one-way — the server proves you know the password without ever being able to recover it.

### 2. Reading a bcrypt hash

`$2b$12$LJ3m4…`:
- `2b` — algorithm/version identifier (bcrypt).
- `12` — the cost factor: 2¹² = 4096 internal iterations.
- the next 22 base64 chars — the **salt**.
- everything after — the digest.

Storing the salt in the open is safe because a salt is not a secret; its only job is to be *unique per password* so identical passwords produce different hashes and precomputed rainbow tables don't apply. Security comes from the salt's uniqueness + bcrypt's slowness, not from hiding the salt. (The server needs the salt to re-hash a login candidate, which is exactly why it's stored alongside.)

### 3. Methods that select `+passwordHash`

In `backend/src/repositories/user.repository.js`:
- `findByEmailWithPassword` — used where an email login/verification needs the hash.
- `findByIdWithPassword` — used by change-password (needs current hash to verify old password).
- `findByIdentifierWithPassword` — used by `login()` in `auth.service.js` (email-or-mobile login).

Each legitimately needs the hash because it's about to call `verifyPassword`. Also relevant: `deleteAccount` in `settings.service.js` re-verifies the password before soft-deleting, so it too reads a hash-bearing user. Every *other* read (profile, `/auth/me`, leaderboards) uses the default queries that exclude the hash.

### 4. Ranking passwords under bcrypt cost 12

From "cracked in minutes" to "effectively safe":
1. **`password123`** — top of every wordlist; cracked essentially instantly even at cost 12, because it's *guessed*, not brute-forced.
2. **`Physics@2027`** — a predictable pattern (word + symbol + year). In targeted wordlists/rules; hours-to-days.
3. **`x9$Kp2#mQ`** — 9 random-ish chars across the full keyset (~57 bits). bcrypt's slowness makes exhaustive search very expensive — years-to-infeasible for a single target.
4. **`correct-horse-battery-staple-jee`** — a long passphrase; enormous entropy. Effectively safe. Key lesson: **length beats complexity**, and bcrypt's cost only multiplies an already-large space — it can't save a password that's *guessable*.

### 5. Timing attack thought experiment

With `storedHash === sha256(salt + password)`: JS `===` on strings can short-circuit at the first differing byte, so a *wrong* guess that shares a longer prefix with the stored value could take marginally longer to reject. In principle an attacker measures response times, fixes the digest byte-by-byte, and narrows the search. In practice this is nearly impossible over a network (jitter dwarfs the signal) and, crucially, **moot for password hashing**: (a) the attacker is comparing against the *hash of their guess*, and a one-bit password change scrambles the whole digest (avalanche) — there's no "getting warmer"; (b) bcrypt's `compare` is constant-time anyway. The takeaway is the *habit*: compare secrets with constant-time functions (`bcrypt.compare`, `crypto.timingSafeEqual`), never raw `===`.

### 6. No `isMobileVerified` check in login

Attack: I sign up with *your* phone number and a password I choose. I never receive the OTP (it went to your phone), so `isMobileVerified` stays false — but `login()` never checks it, so **I can still log in with my password** and use the account. What I *can't* do: complete any flow that actually needs the phone (there's little today), and you'd notice if you tried to sign up with your own number (`MOBILE_TAKEN`). The one-line fix in `login()`:

```js
if (!user.isMobileVerified) throw ApiError.forbidden("Verify your mobile number first.");
```

UX cost: users who signed up but abandoned OTP verification are now locked out and must complete verification (or you must add a "resend OTP on login" path). That friction is why some products defer the check — it's a real tradeoff, not an oversight to fix blindly.

### 7. `{"identifier": {"$gt": ""}, "password": "x"}` through the layers

- **`sanitize`** runs first (app-wide). `scrub` walks the body, sees the key `$gt` inside `identifier`, and — because `key.startsWith("$")` — deletes it. `identifier` becomes `{}`.
- **`validate(loginSchema)`** runs next. `identifier: z.string()...` rejects a non-string (now `{}`) with a **422** before any DB call. *This is where it dies* even in the worst case.
- **`findByIdentifierWithPassword`** never sees an operator because both earlier layers neutralized it.

Removing layers one at a time: drop `validate` → sanitize still stripped `$gt`, so the query gets `{ mobile: {} }` and matches nothing (fails safe). Drop `sanitize` but keep `validate` → zod rejects the object at 422 (fails safe). Drop **both** → `findOne({ mobile: { $gt: "" } })` returns the first user and, combined with a password bypass, becomes an auth bypass. The point: two independent layers each suffice; defense in depth means either alone saves you.

### 8. Signup enumeration vs reset non-enumeration

Both leak "does this identifier exist?" — but the *cost/benefit* differs. Signup must tell you "mobile taken," or users can't recover from a duplicate and UX collapses; the info leaked (a mobile is registered) is lower-value and partly mitigated by rate limiting. Password reset has no such UX need — "we sent a link if the account exists" is perfectly usable — and the info leaked (this *email* has an account you can now target with phishing/reset-flooding) is higher-value. So it's defensible to accept enumeration where it's unavoidable for UX and the payoff is low, while eliminating it where it's free to do so and the payoff is high. Consistency matters less than a deliberate, documented decision per surface.

---

## Module 4.2 — JWTs, Cookies & Sessions

### 1. Decode a token

`Buffer.from(part, "base64url").toString()` on parts 1 and 2. Access-token claims your backend sets (all in `backend/src/utils/jwt.util.js` + `session.service.js → accessPayload`):
- `sub` — user id (`accessPayload`: `String(user._id)`).
- `role` — from the user.
- `email` — from the user (may be undefined).
- `type: "access"` — added by `signAccessToken` (from `constants/tokens.js`).
- `iat`, `exp` — set by jsonwebtoken via `expiresIn: "15m"`.
- `iss: "rankos.api"`, `aud: "rankos.client"` — from `signAccessToken` options.

The signature (part 3) won't decode to text — it's raw HMAC bytes.

### 2. Read-but-not-change; why the frontend can't verify

Everyone can *read* a JWT because the payload is only base64url-**encoded**, not encrypted — encoding is reversible by anyone. Nobody can *change* it because any edit changes the bytes that were signed, so the recomputed HMAC no longer matches the attached signature; verification (`jwt.verify`) rejects it. With **HS256** the same secret both signs and verifies (symmetric). If the frontend held that secret to verify tokens, it could also *mint* them — so the secret must stay server-only, and the frontend simply trusts the server. (Asymmetric RS256 would let the frontend verify with a public key while only the server signs with the private key — a different design.)

### 3. Stealing access vs refresh cookie

**Access cookie only:** the thief can call any protected endpoint as you — but only until the access token's `exp` (≤15 min). They *cannot* refresh, because the refresh cookie is path-scoped to `/api/auth` and wasn't stolen. When the access token expires, they're locked out. Mechanism that ends it: the short access TTL.

**Refresh cookie only:** far worse. The thief trades it for fresh access+refresh pairs indefinitely, effectively owning the session for up to 7–30 days. What ends it: (a) you logging out (revokes that token), (b) a password reset (revokes all), or (c) the **reuse-detection alarm** if both you and the thief use the same token across a rotation — which nukes the whole family. This asymmetry is exactly why the refresh cookie is httpOnly *and* path-scoped: minimize where the powerful token is ever transmitted.

### 4. Why check `tokenHash` when `jti` already matched

`jti` is inside the JWT payload — readable, and not by itself proof of authenticity. The `tokenHash` check (`record.tokenHash !== hashToken(rawRefreshToken)`) proves the *specific token string* presented is the one that was issued for that `jti`. Scenario: after a secret rotation you re-sign tokens; an attacker replays an *old* JWT that happens to carry a `jti` still present in the DB, but the old token string hashes differently from the stored `tokenHash` → rejected. More generally it defends against any case where a `jti` is known/guessed but the exact signed token isn't held. It's the "you must present the actual token, not just know its id" gate.

### 5. Reuse-detection timeline

Order A — thief uses first (12:05), victim refreshes second (12:10):
- 12:00 thief steals token T (jti=J).
- 12:05 thief calls refresh with T → valid, not revoked → server issues T2, **revokes J**. Thief now holds a live session.
- 12:10 victim's app auto-refreshes with T (still the old one in their cookie) → `findByJti(J)` shows `revokedAt ≠ null` → **reuse detected → revokeAllForUser** → both T and T2 dead. Victim gets "sign in again"; thief's T2 also dies on its next use. Net: brief thief access, then everyone re-logs, thief locked out.

Order B — victim first, thief second:
- 12:05 victim refreshes with T → T2 issued, J revoked. Victim fine.
- 12:07 thief replays T → J already revoked → **reuse detected → revoke all** → victim's T2 also killed; both must re-login. Thief gains nothing.

Either way the alarm fires the moment the *second* party reuses a rotated token; the difference is only whether the thief got a few minutes first (Order A). The victim is briefly inconvenienced in both; the thief is always ultimately locked out.

### 6. Dropping the `type` check with a shared secret

If both families used one secret and there were no `type` check, a **refresh** token would also verify as an **access** token and vice-versa. Concrete self-attack: take your long-lived (30-day) refresh token and send it as your `Authorization: Bearer` / access cookie — `verifyAccessToken` would accept it, giving you a 30-day "access token" that never needs refreshing and never gets rotated/revoked, defeating the whole short-TTL containment. Which single defense stops it: **either** alone does. Separate secrets → the refresh token fails the access secret's signature check. The `type` claim → even with a shared secret, `decoded.type !== "access"` throws. The code keeps both (belt and suspenders).

### 7. Populate `replacedByJti`

`issueSession` currently returns only the token strings, not the new `jti`. Minimal change: have `issueSession` also return `jti` (it already has it locally), then in `rotateSession`:

```js
const next = await issueSession({ user, req, rememberMe });   // now returns next.jti
await refreshTokenRepository.revoke(decoded.jti, next.jti);   // record the successor
```

`revoke(jti, replacedByJti)` already supports the second arg. After a theft alarm a security engineer could then reconstruct the **full rotation chain** — walk `replacedByJti` links to see exactly how many times the token rotated, when the fork happened (two children of one parent = the theft point), and thus roughly when the compromise began and how active the thief was. Today that forensic trail is lost because every rotation stores `null`.

### 8. Cookie clearing attributes

Browsers identify a cookie by name **+ domain + path** (and treat `secure`/`httpOnly`/`sameSite` as part of matching in modern browsers). To *delete* a cookie the server sends a `Set-Cookie` with the same identifying attributes and an expiry in the past; if `path` or `domain` differ, the browser thinks it's a *different* cookie and leaves the original in place — the classic "logout doesn't log out" bug. `maxAge` is the exception: it's not part of identity, it's the *lifetime*, and clearing means "expire it now," so you deliberately don't repeat the original `maxAge` (the library sets an immediate expiry). Hence `clearAuthCookies` mirrors `httpOnly/secure/sameSite/domain/path` but omits `maxAge`.

---

## Module 4.3 — OTPs, Verification & Password Reset

### 1. Entropy math

- **6-digit OTP:** 10⁶ = 1,000,000 possibilities (~20 bits). With 5 attempts per code, success probability per code ≈ 5/1,000,000 = 0.0005%. Low entropy → *must* have an attempt counter; it's the only thing making it safe.
- **8-char lowercase password:** 26⁸ ≈ 2×10¹¹ (~37 bits). Guessable offline if you have the hash and it's a *fast* hash → *must* use bcrypt to slow each guess. No per-request attempt counter helps offline attacks.
- **32-byte reset token:** 256 bits, ~10⁷⁷ possibilities. Unguessable by any brute force → needs *neither* an attempt counter *nor* a slow hash (SHA-256 at rest is plenty). The rule: the defense must match the entropy — attempt-cap for tiny spaces, slow-hash for medium offline-attackable spaces, nothing extra for astronomically large spaces.

### 2. Why consume the OTP on the 5-attempt cap

`findLatestActive` returns the *newest un-consumed, un-expired* OTP. If the 429 branch threw *without* consuming, the same maxed-out OTP would still be "active," so the very next request would fetch it again, re-hit `attempts >= MAX_ATTEMPTS`, and 429 again — the code is permanently jammed but never cleared, and (worse) the attempt cap becomes a no-op wall rather than a reason to force a *fresh* code. Consuming it makes the state machine advance: the dead code is gone, `findLatestActive` returns null next time (→ "request a new one"), and the user is pushed to resend. Consuming = "this code is spent, move on."

### 3. Best attack on verify-otp with unlimited IPs

With many IPs you dodge the per-IP auth limiter (30/15 min), so the limiter isn't your bottleneck. But `verifyOtp` caps attempts **per code** at 5, and each code lives ≤5 minutes and is single-use/newest-only. So per issued code you get at most **5 guesses**, success ≈ 5/1,000,000 per code regardless of IP count. To improve odds you'd have to force many *new* codes (each fresh 5 guesses) — but issuing codes is itself rate-limited and each new code invalidates the last. The true bottleneck is `MAX_ATTEMPTS = 5` (with `incrementAttempts`/`consume` enforcing it) — the single constant your entire botnet is fighting. That's why the attempt cap, not the IP limiter, is the load-bearing OTP defense.

### 4. Cross-flow attack without purpose scoping

Suppose `"reset"` OTPs exist and `findLatestActive` ignored `purpose`. Attacker flow: trick the victim into requesting a **signup/login** OTP (something low-stakes they'll happily complete, or that you can trigger), which delivers a code to their phone. Meanwhile the attacker initiates a **password-reset** for the victim and, at the verify step, submits that same code — because the lookup no longer distinguishes purposes, a signup code satisfies the reset check → attacker resets the password and takes over. Purpose scoping (`{ user, purpose, ... }` in `findLatestActive`) makes a code minted for one flow useless in another, closing this. Codes must be bound to intent.

### 5. Server-side resend cooldown

Use the newest `Otp` for `(user, purpose)` and its `createdAt`:

```js
const COOLDOWN_MS = 28 * 1000;
const latest = await otpRepository.findLatestActive(userId, purpose); // or findLatest incl. consumed
if (latest && Date.now() - latest.createdAt.getTime() < COOLDOWN_MS) {
  const retryAfter = Math.ceil((COOLDOWN_MS - (Date.now() - latest.createdAt)) / 1000);
  throw new ApiError(429, `Please wait ${retryAfter}s before requesting a new code.`, {
    code: "OTP_COOLDOWN",
  });
}
```

**429 (Too Many Requests)** fits because it's precisely "you're allowed, just not yet" — and you can attach a `Retry-After` header. This caps SMS spend and OTP-invalidation DoS server-side, so it doesn't rely on the client's honor-system countdown. (You'd want a query that returns the newest record even if consumed, to also throttle right after a successful verify.)

### 6. The OAuth stub attack

From `oauthCallback`, the identity is read straight from the query string. An attacker requests:

```
GET /api/auth/oauth/google/callback?stub=1&providerId=whatever&email=principal@school.edu&name=Principal
```

`loginWithProvider` then does `findByProvider("google", "whatever")` (miss), falls to `findByEmail("principal@school.edu")` — and **if a real account with that email exists**, it calls `addAuthProvider` to *link this attacker-controlled provider identity to the victim's account*, then issues a session **as the victim**. Even if no account exists, it creates one with `isEmailVerified: true` for an email the attacker never proved they own. The real implementation must **exchange the `code` for tokens with the provider and fetch the verified profile from the provider's API** — never trust an email/providerId from the query string. Until then this must never run outside a local dev stub (it's gated on missing credentials, but the callback itself does no verification).

### 7. Reset-flow defenses, by property

- **(a) Enumeration:** `forgotPassword` returns `{ sent: true }` unconditionally; the `if (user)` block is externally invisible. (`auth.service.js → forgotPassword`.)
- **(b) DB leak:** only `tokenHash` (SHA-256 of a 256-bit token) is stored via `generateOpaqueToken` + `passwordResetTokenRepository.create`; the raw token lives only in the email. A leaked DB yields no usable tokens.
- **(c) Replay:** `findActiveByHash` requires `usedAt: null` and `expiresAt > now`; `consume` sets `usedAt` in the same transaction as the password update; `invalidateAllForUser` kills older tokens on each new request. Single-use + newest-only + short TTL.
- **(d) Attacker already holding a session:** after the reset transaction, `refreshTokenRepository.revokeAllForUser(record.user)` revokes every session — the whole reason people reset. (Best-effort, post-transaction — noted wart.)

### 8. Reset TTL drift — everywhere to change, and the fix

Places encoding the lifetime today:
1. `backend/src/config/env.js` → `auth.passwordResetTtlMs` (30 min default via `PASSWORD_RESET_EXPIRES`).
2. `auth.service.js → forgotPassword`: the email `text` string "valid 30 minutes".
3. `auth.service.js → forgotPassword`: the email `html` string "valid 30 minutes".
4. `rankos-ai-mentor/API_SPEC.md` says "15-min expiry" — the spec itself disagrees.

Clean refactor: make `env.auth.passwordResetTtlMs` the single source of truth, derive a human string from it once (e.g. `const mins = env.auth.passwordResetTtlMs / 60000;`), and interpolate `${mins} minutes` into both email bodies — so the copy can never drift from the enforced TTL. Then decide 15 vs 30 and set `PASSWORD_RESET_EXPIRES` accordingly, and update the spec to match. One value, one place.

---

## Module 4.4 — Security Mastery

### 1. Injection walkthrough (two-plus layers)

POST `{ "identifier": { "$gt": "" }, "password": { "$gt": "" } }`:
- **After `sanitize`:** `scrub` deletes the `$gt` keys (they start with `$`), leaving `identifier: {}` and `password: {}`. The operator is already gone.
- **After `validate(loginSchema)`:** `identifier`/`password` are declared `z.string()`; the now-empty objects fail type validation → **422**, no controller runs.
- (Had both been bypassed, **Mongoose** would still treat the value as a field match, but with sanitize+validate the request never reaches the query.) At least two independent layers each stop it; either alone suffices.

### 2. Prototype pollution mechanism

Every JS object delegates to a shared parent via `__proto__` → `Object.prototype`. Writing into `__proto__` mutates that *shared* parent, so a property set there appears on **every** object in the process (`({}).isAdmin` becomes `true` everywhere). `sanitize`'s `BLOCKED_KEYS` deletes `__proto__`/`constructor`/`prototype` from the parsed body before anything merges it, so the poison key never reaches a downstream assignment. Symptom if removed (with a vulnerable deep-merge): app-wide logic that checks `obj.isAdmin`/`obj.role` would suddenly pass for unrelated objects, or a crafted key could crash request handling (DoS) — because you changed the behavior of *all* objects at once, not just the request body.

### 3. Rate-limit math

Even with 10,000 IPs, the **per-code** attempt cap dominates: one issued OTP allows 5 guesses total (across all IPs — the cap is on the code's `attempts` field, not per IP) and lives ≤5 min. So against a *single issued code* you get ~5 guesses → ~0.0005% success. Spreading across IPs beats the per-IP auth limiter (30/15 min) but does nothing about the attempt cap. To get more guesses you must force more codes, but issuance is rate-limited and each new code invalidates the prior. **The OTP attempt-cap is the true bottleneck**, not the IP-based limiter — which is the whole point of having both as independent layers.

### 4. Fix the CORS footgun

Production `.env`:
```
CORS_ORIGIN=https://app.rankos.example
CORS_CREDENTIALS=true
```
(Multiple origins: comma-separate — `env.js` `list()` splits them.) Startup guard mirroring the SameSite check, in the `if (NODE_ENV === "production")` block of `env.js`:
```js
const wildcard = process.env.CORS_ORIGIN === "*" || !process.env.CORS_ORIGIN;
if (wildcard && bool(process.env.CORS_CREDENTIALS, true)) {
  console.error("\n[env] CORS_ORIGIN='*' with credentials is forbidden in production. Set explicit origin(s).\n");
  process.exit(1);
}
```
Fails safe at boot instead of silently shipping a wide-open credentialed API.

### 5. IDOR hunt (tasks example)

Ownership-scoped (safe), `tasks.service.js`:
```js
await StudyTask.deleteOne({ _id: taskId, user: userId });  // userId = req.user.id
```
Vulnerable version:
```js
await StudyTask.deleteOne({ _id: taskId });                // no owner scope → IDOR
```
Exploit: `DELETE /api/tasks/<someone-elses-taskId>` deletes a stranger's task because only `_id` is matched. Pulling `userId` from `req.body` reintroduces the flaw even with the correct-looking `{ _id, user }` shape, because the attacker controls the body and simply sends the *victim's* `user` id — the query looks scoped but is attacker-directed. The identity **must** come from the verified token (`req.user.id`), which the client cannot forge. That's the invariant: authorization data is never taken from the request body.

### 6. Header audit (sample)

- **`X-Content-Type-Options: nosniff`** — blocks MIME-sniffing (browser executing a JSON/text response as HTML/JS). Matters more for the frontend serving user content; for a pure JSON API the risk is low but the header is free.
- **`X-Frame-Options` / `frame-ancestors`** — clickjacking (framing your page over a decoy). Only relevant where you serve interactive HTML — i.e., the frontend, not `/api` JSON.
- **`Strict-Transport-Security`** — forces HTTPS on return visits; matters for *any* origin served over TLS, API included. This is the one you'd **tune** (set `max-age`, `includeSubDomains`, `preload`) rather than accept a bare default, and only enable once you're confident everything is HTTPS. **CSP** is the other prime tuning candidate — meaningful for the frontend's HTML, near-irrelevant for JSON, so you'd scope it there.

### 7. OWASP self-assessment (sample weakest three)

- **A05 Security Misconfiguration** (🚨 CORS default): add the startup guard from Exercise 4 + set explicit `CORS_ORIGIN`. Effort: ~15 minutes. Highest bang-for-buck.
- **A07 Auth Failures** (no breached-password check, no verified-mobile gate on login): integrate a k-anonymity "have i been pwned" range check at signup/reset, and add the `isMobileVerified` gate (Module 4.1 Ex 6). Effort: a few hours + a UX decision.
- **A06 Vulnerable Components** (unaddressed in source): add `npm audit --production` to CI and enable Dependabot/Renovate. Effort: ~1 hour, then ongoing. Each moves the row from ⚠️/🚨 toward ✅.

### 8. Design an account-level lockout

Count **consecutive failed logins per user** (increment on each `verifyPassword` failure in `login()`, reset to 0 on success). Store the counter + a `lockedUntil` timestamp — in Redis if present (keyed `login:fail:<userId>`, with a TTL that doubles as the window), else a couple of User fields. **Lock** when the count crosses a threshold (e.g. 10) by setting `lockedUntil = now + 15min` and rejecting logins until it passes. **Recovery:** the lock auto-expires (time-based), and/or a successful password reset clears it (people who forgot their password shouldn't stay locked). **New abuse it enables — targeted DoS:** if I know your email/mobile, I can *deliberately* fail logins to keep *your* account locked. Mitigations: prefer an exponential *slowdown* over a hard lock, or lock the attacking IP rather than the account, or require a CAPTCHA before counting toward lockout — so the lockout can't be weaponized to deny a legitimate user access. Every lockout design must ask "who can trigger this against whom?"

---

*End of Module 4 solutions. Revisit the chapters: [4.1](01-password-and-hashing.md) · [4.2](02-jwt-and-sessions.md) · [4.3](03-otp-verification-reset.md) · [4.4](04-security-mastery.md).*
