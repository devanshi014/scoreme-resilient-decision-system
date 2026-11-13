const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluateRules } = require("../src/engine/rules");

test("passes configured mandatory and threshold rules", () => {
  const result = evaluateRules(
    { applicant: { name: "A", age: 22 }, financial: { debtToIncome: 0.2 } },
    [
      { id: "1", type: "mandatory", field: "applicant.name", operator: "notEmpty", failureOutcome: "REJECTED" },
      { id: "2", type: "threshold", field: "applicant.age", operator: "gte", value: 18, failureOutcome: "REJECTED" }
    ]
  );
  assert.equal(result.outcome, "APPROVED");
  assert.equal(result.trace.length, 2);
  assert.ok(result.trace.every(x => x.passed));
});

test("rejects when a mandatory rule fails", () => {
  const result = evaluateRules({ applicant: { name: "" } }, [
    { id: "1", type: "mandatory", field: "applicant.name", operator: "notEmpty", failureOutcome: "REJECTED", reason: "Name required" }
  ]);
  assert.equal(result.outcome, "REJECTED");
  assert.equal(result.trace[0].passed, false);
});

test("routes threshold failure to manual review", () => {
  const result = evaluateRules({ applicant: { monthlyIncome: 10000 } }, [
    { id: "1", type: "threshold", field: "applicant.monthlyIncome", operator: "gte", value: 25000, failureOutcome: "MANUAL_REVIEW" }
  ]);
  assert.equal(result.outcome, "MANUAL_REVIEW");
});
