const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const request = require("supertest");
const { JsonStore } = require("../src/store/jsonStore");
const { createApp } = require("../src/app");

const valid = (applicationId, extra = {}) => ({
  applicationId,
  applicant: { name: "Aarav Sharma", age: 25, monthlyIncome: 50000, identityVerified: true },
  financial: { debtToIncome: 0.25 },
  ...extra
});

async function setup(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "scoreme-test-"));
  const configPath = path.join(dir, "workflow.json");
  await fs.copyFile(path.resolve("config/application-approval.json"), configPath);
  const store = await new JsonStore(path.join(dir, "data")).init();
  const app = await createApp({ store, configPath });
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return { app, store };
}

test("API rejects invalid input before creating a workflow", async t => {
  const { app, store } = await setup(t);
  const res = await request(app).post("/api/applications").send({ applicationId: "BAD", applicant: {}, financial: {} });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, "INVALID_INPUT");
  assert.equal(store.listRequests().length, 0);
});

test("same idempotency key returns original result without re-execution", async t => {
  const { app, store } = await setup(t);
  const first = await request(app).post("/api/applications").set("Idempotency-Key", "same-key").send(valid("APP-DUP-1"));
  const replay = await request(app).post("/api/applications").set("Idempotency-Key", "same-key").send(valid("APP-DUP-2"));
  assert.equal(first.status, 201);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.applicationId, "APP-DUP-1");
  assert.equal(replay.body.idempotentReplay, true);
  assert.equal(store.listRequests().length, 1);
});


test("duplicate application ID with a different key is rejected", async t => {
  const { app, store } = await setup(t);
  const first = await request(app).post("/api/applications").set("Idempotency-Key", "key-1").send(valid("APP-SAME-ID"));
  const second = await request(app).post("/api/applications").set("Idempotency-Key", "key-2").send(valid("APP-SAME-ID"));
  assert.equal(first.status, 201);
  assert.equal(second.status, 409);
  assert.equal(store.listRequests().length, 1);
});

test("transient dependency outage retries and exhausts configured attempts", async t => {
  const { app } = await setup(t);
  const res = await request(app).post("/api/applications").send(valid("APP-RETRY", { simulateDependencyFailure: true }));
  assert.equal(res.status, 201);
  assert.equal(res.body.state, "RETRY_EXHAUSTED");
  assert.equal(res.body.attempts, 3);
  assert.equal(res.body.decision.attempts, 3);
});

test("permanent negative identity result routes to manual review, not retry", async t => {
  const { app } = await setup(t);
  const res = await request(app).post("/api/applications").send({
    applicationId: "APP-ID-FAIL",
    applicant: { name: "Aarav", age: 25, monthlyIncome: 50000, identityVerified: false },
    financial: { debtToIncome: 0.2 }
  });
  assert.equal(res.body.state, "MANUAL_REVIEW");
  assert.equal(res.body.attempts, 1);
});

test("rule configuration can change threshold without code change", async t => {
  const { app } = await setup(t);
  const configRes = await request(app).get("/api/config");
  const changed = configRes.body;
  changed.version += 1;
  changed.rules.find(rule => rule.id === "R003").value = 10000;
  const update = await request(app).put("/api/config").send(changed);
  assert.equal(update.status, 200);
  const result = await request(app).post("/api/applications").send(valid("APP-NEW-RULE", {
    applicant: { name: "Aarav", age: 25, monthlyIncome: 20000, identityVerified: true }
  }));
  assert.equal(result.body.state, "APPROVED");
  assert.equal(result.body.decision.configVersion, 2);
});

test("audit endpoint exposes rule trace and retry evidence", async t => {
  const { app } = await setup(t);
  await request(app).post("/api/applications").send(valid("APP-AUDIT", { simulateDependencyFailure: true }));
  const res = await request(app).get("/api/applications/APP-AUDIT/audit");
  assert.equal(res.status, 200);
  assert.ok(res.body.some(event => event.event === "RULES_EVALUATED"));
  assert.ok(res.body.some(event => event.event === "RETRY_SCHEDULED"));
});
