# Lesson 6 — Authentication (How Login Actually Works)

> **Goal:** understand passwords, hashing, tokens, and OTPs — using your app's
> real auth system. This is the most security-critical code in any app.

Two separate questions, two words:

- **Authentication** ("authn") — *who are you?* (login)
- **Authorization** ("authz") — *what are you allowed to do?* (student vs teacher
  vs parent — see `role` in the user model)

## Rule 1: passwords are never stored 🔑

Look at the user model: the field is `passwordHash`, not `password`. When a user
signs up, the password goes through **bcrypt** (in your dependencies) — a one-way
scrambler:

```
"myPassword123"  →  bcrypt  →  "$2b$10$N9qo8uLOickgx2ZMRZoMye..."
```

- One-way: you cannot compute the password back from the hash.
- At login, the submitted password is hashed again and the *hashes* are compared.
- bcrypt is deliberately **slow** and adds a random "salt" per user, so even if
  the database leaked, cracking passwords en masse is impractical, and two users
  with the same password get different hashes.

So even the app's own developers can't see anyone's password. That's the point.

## Rule 2: HTTP has no memory — so we use tokens 🎫

HTTP is **stateless**: every request arrives as a stranger. The server can't
"remember" you logged in a moment ago. The fix — give the client a wristband:

1. User logs in successfully.
2. Backend issues a **JWT** (JSON Web Token — the `jsonwebtoken` package): a
   string encoding *"user 66a0c9…, role student, expires at 15:30"*, **signed**
   with a secret key only the server knows.
3. The frontend stores it and sends it with every request:
   `Authorization: Bearer eyJhbGciOi...`
4. `src/middlewares/authenticate.js` verifies the signature and expiry on each
   request, then sets `req.user`. No database lookup needed to trust it — the
   signature proves the server itself issued it, and any tampering (say, editing
   the role to "teacher") breaks the signature.

Anyone can *read* a JWT's contents (it's only encoded, not encrypted) — its
power is that nobody can *forge or alter* one without the secret. That secret
lives in `.env`, never in code.

## Access + refresh: the two-token pattern

Notice `refreshToken.model.js` in your models. Your app uses the standard pair:

| Token | Lifespan | Job |
|---|---|---|
| **Access token** (JWT) | minutes–hours | sent with every API request |
| **Refresh token** | days–weeks | stored server-side; used only to mint a new access token when the old one expires |

Why? If an access token is stolen, it dies quickly. Refresh tokens are stored in
the DB, so they can be **revoked** — that's what "log out of all devices" does:
delete the refresh tokens.

## The supporting cast (all real files in your app)

- `emailVerificationToken.model.js` — the "click the link we emailed you" token,
  proving the user owns the email address.
- `passwordResetToken.model.js` — the "forgot password" flow: a short-lived,
  single-use token emailed to the user.
- `otp.model.js` + `services/otp.service.js` + `services/sms.service.js` —
  **OTP** login: a 6-digit code sent by SMS, valid a few minutes. Proves you own
  the phone number; no password involved.
- `services/session.service.js` — issuing/refreshing/revoking sessions.
- `middlewares/rateLimiter.js` — also security! It stops attackers from guessing
  passwords or OTPs thousands of times per minute.

## ⚠️ The real state of auth in YOUR app (from Lesson 3)

The backend was rebuilt to match the frontend's **mobile + OTP** contract, so
the full flow — signup → verify OTP → login → me → logout → forgot/reset
password — exists and works. Three honest caveats (all covered deeply in
Module m4):

1. **SMS is a dev stub** — OTP codes are printed to the server logs, not sent
   to a phone. Real SMS needs a provider key in `.env`.
2. **Signup collects no email**, so the forgot-password (email) flow can't be
   reached by a normal user yet.
3. **OAuth (Google/Apple) is a stub** with a known security hole — it trusts
   identity data from the URL. Never ship it as-is.

Also note: your app delivers tokens via **httpOnly cookies** (the browser
attaches them automatically) rather than the frontend storing a token and
sending an `Authorization` header — same JWT ideas, safer packaging.

## Authorization: roles

After `authenticate` establishes *who*, route guards check *what they may do*.
Your app has roles (`student`, plus parent/teacher — see
`src/constants/roles.js`), and features like `parent.routes.js` /
`teacher.routes.js` are meant for those roles. A student calling a
teacher-only endpoint should get `403 Forbidden` (403 = "I know who you are,
and no").

---

## ✏️ Exercises

1. Explain to an imaginary friend why a database leak at a well-built company
   doesn't reveal user passwords. Use the words "hash" and "salt".
2. What's the difference between `401 Unauthorized` and `403 Forbidden`?
3. Open `src/middlewares/authenticate.js` and read it top to bottom slowly.
   Write down: where does the token come from? What two things are verified?
   What lands on `req.user`?
4. Open `src/models/refreshToken.model.js`. How does the app know when a stored
   refresh token has expired?
5. **Think like an attacker:** why must OTPs be rate-limited *and* expire in
   minutes? What attack works on a 6-digit code that doesn't expire?

**Next:** [Lesson 7 — The Frontend (React)](07-frontend-react.md)
