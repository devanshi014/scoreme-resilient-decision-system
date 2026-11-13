const test = require("node:test");
const assert = require("node:assert/strict");
const { applicationSchema } = require("../src/validation");

test("accepts a valid application", () => {
  const parsed = applicationSchema.safeParse({
    applicationId: "APP-1",
    applicant: { name: "Dev", age: 21, monthlyIncome: 40000 },
    financial: { debtToIncome: 0.2 }
  });
  assert.equal(parsed.success, true);
});

test("rejects malformed and unexpected fields", () => {
  const parsed = applicationSchema.safeParse({
    applicationId: "APP-2",
    applicant: { name: "", age: -1, monthlyIncome: -5 },
    financial: { debtToIncome: 0.2 },
    unexpected: true
  });
  assert.equal(parsed.success, false);
});
