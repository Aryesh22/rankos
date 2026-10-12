/**
 * End-to-end integration tests. Boots the real Express app against an in-memory
 * MongoDB (mongodb-memory-server), seeds demo data, and exercises the critical
 * paths: auth, protected reads, the AI layer, uploads/OCR, and access control.
 *
 * `node --test` runs each test file in its own process, so setting MONGODB_URI
 * in `before()` (prior to the first config import) safely points the app at the
 * in-memory database.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongod;
let mongoose;
let api;
let cookies;

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.NODE_ENV = "test";
  process.env.SWAGGER_ENABLED = "false";

  const seeds = await import("../seeds/index.js");
  await seeds.run();

  const { app } = await import("../app.js");
  mongoose = (await import("mongoose")).default;
  const supertest = (await import("supertest")).default;
  api = supertest(app);

  const login = await api
    .post("/api/auth/login")
    .send({ identifier: "aarav@example.com", password: "password123", rememberMe: true });
  cookies = login.headers["set-cookie"];
});

after(async () => {
  if (mongoose) await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

const auth = (req) => req.set("Cookie", cookies);

test("login issues a session cookie", () => {
  assert.ok(Array.isArray(cookies) && cookies.some((c) => c.startsWith("access_token")));
});

test("signup validation returns 422 with field errors", async () => {
  const res = await api
    .post("/api/auth/signup")
    .send({ name: "X", mobile: "1", password: "short", exam: "JEE" });
  assert.equal(res.status, 422);
  assert.ok(res.body?.error?.fields);
});

test("GET /auth/me requires authentication", async () => {
  assert.equal((await api.get("/api/auth/me")).status, 401);
});

test("dashboard returns seeded student data", async () => {
  const res = await auth(api.get("/api/dashboard"));
  assert.equal(res.status, 200);
  assert.equal(res.body.student.streak, 46);
  assert.equal(res.body.todayPlan.length, 5);
});

test("mistakes filter works and rejects NoSQL injection", async () => {
  const ok = await auth(api.get("/api/mistakes?status=Pending"));
  assert.equal(ok.status, 200);
  assert.ok(ok.body.data.every((m) => m.status === "Pending"));
  // Injected operator is stripped → treated as no filter, still 200.
  const inj = await auth(api.get("/api/mistakes?status[$ne]=Pending"));
  assert.equal(inj.status, 200);
  assert.ok(Array.isArray(inj.body.data));
});

test("AI status reports the grounded local provider (no key set)", async () => {
  const res = await auth(api.get("/api/ai/status"));
  assert.equal(res.status, 200);
  assert.equal(res.body.provider, "local");
});

test("AI mentor returns a grounded, non-empty reply", async () => {
  const res = await auth(api.post("/api/mentor/chat")).send({ conversationId: null, text: "help" });
  assert.equal(res.status, 200);
  assert.ok(res.body.reply.text.length > 30);
});

test("AI notes generate + list for a topic", async () => {
  const gen = await auth(api.post("/api/topics/geo3d/notes")).send({});
  assert.equal(gen.status, 201);
  assert.ok(gen.body.content.includes("3D Geometry"));
  const list = await auth(api.get("/api/topics/geo3d/notes"));
  assert.equal(list.body.data.length, 1);
});

test("test attempt lifecycle hides answers and scores on submit", async () => {
  const start = await auth(api.post("/api/tests/pt-07/attempts")).send({});
  assert.equal(start.status, 201);
  assert.ok(start.body.questions.every((q) => q.correctIndex === undefined));
  const submit = await auth(api.post(`/api/attempts/${start.body.attemptId}/submit`)).send({
    durationUsedSec: 4000,
  });
  assert.equal(submit.status, 200);
  assert.equal(typeof submit.body.score, "number");
  const result = await auth(api.get(`/api/attempts/${start.body.attemptId}/result`));
  assert.ok(result.body.aiFeedback.length > 40);
});

test("upload + OCR pipeline parses questions", async () => {
  const png = Buffer.from("89504e470d0a1a0a", "hex");
  const res = await auth(api.post("/api/uploads")).attach("file", png, {
    filename: "sheet.png",
    contentType: "image/png",
  });
  assert.equal(res.status, 201);
  assert.ok(res.body.parsedCount >= 4);
});

test("upload rejects unsupported file types", async () => {
  const res = await auth(api.post("/api/uploads")).attach("file", Buffer.from("x"), {
    filename: "a.exe",
    contentType: "application/x-msdownload",
  });
  assert.equal(res.status, 400);
});

test("role-based access control blocks a student from teacher routes", async () => {
  assert.equal((await auth(api.get("/api/teacher/overview"))).status, 403);
});
