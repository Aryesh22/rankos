import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

// Ensure required env exists before importing the app (env.js validates on load).
process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/rankos_test";

const { app } = await import("../app.js");

test("GET /api/health/live → 200 alive", async () => {
  const res = await request(app).get("/api/health/live");
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.status, "ok");
});

test("GET /api/health → 200 with dependency info", async () => {
  const res = await request(app).get("/api/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data.dependencies);
  assert.ok(typeof res.body.data.uptimeSeconds === "number");
});

test("unknown route → 404 with error envelope", async () => {
  const res = await request(app).get("/api/does-not-exist");
  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, "NOT_FOUND");
});

test("every response carries an x-request-id header", async () => {
  const res = await request(app).get("/api/health/live");
  assert.ok(res.headers["x-request-id"]);
});
