function getPath(object, dottedPath) {
  return dottedPath.split(".").reduce((value, key) => value == null ? undefined : value[key], object);
}

function evaluateOperator(actual, operator, expected) {
  switch (operator) {
    case "notEmpty": return actual !== undefined && actual !== null && String(actual).trim() !== "";
    case "eq": return actual === expected;
    case "neq": return actual !== expected;
    case "gt": return Number(actual) > Number(expected);
    case "gte": return Number(actual) >= Number(expected);
    case "lt": return Number(actual) < Number(expected);
    case "lte": return Number(actual) <= Number(expected);
    case "in": return Array.isArray(expected) && expected.includes(actual);
    default: throw new Error(`Unsupported rule operator: ${operator}`);
  }
}

function evaluateRules(input, rules, dependencyResults = {}) {
  const trace = [];
  let outcome = "APPROVED";

  for (const rule of rules) {
    let passed;
    let actual;
    let failureOutcome = rule.failureOutcome;
    if (rule.type === "dependency") {
      actual = dependencyResults[rule.dependency];
      passed = actual === true;
      failureOutcome = dependencyResults[`${rule.dependency}FailureOutcome`] || rule.failureOutcome;
    } else {
      actual = getPath(input, rule.field);
      passed = evaluateOperator(actual, rule.operator, rule.value);
    }

    trace.push({
      ruleId: rule.id,
      ruleName: rule.name,
      passed,
      field: rule.field || null,
      actualValue: actual === undefined ? null : actual,
      expected: rule.value === undefined ? null : rule.value,
      reason: passed ? "Rule passed." : rule.reason,
      failureOutcome: passed ? null : failureOutcome
    });

    if (!passed && failureOutcome && failureOutcome !== "RETRY") {
      if (failureOutcome === "REJECTED") outcome = "REJECTED";
      else if (outcome !== "REJECTED" && failureOutcome === "MANUAL_REVIEW") outcome = "MANUAL_REVIEW";
    } else if (!passed && failureOutcome === "RETRY" && outcome === "APPROVED") {
      outcome = "RETRY";
    }
  }
  return { outcome, trace };
}

module.exports = { evaluateRules, getPath };
