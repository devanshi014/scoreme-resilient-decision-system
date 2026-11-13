const { evaluateRules } = require("./rules");
const { runDependencies } = require("./dependency");

const ALLOWED = new Set(["RECEIVED", "PROCESSING", "APPROVED", "REJECTED", "MANUAL_REVIEW", "RETRY_EXHAUSTED"]);

function transition(request, nextState, actor, reason) {
  if (!ALLOWED.has(nextState)) throw new Error(`Invalid state: ${nextState}`);
  const previousState = request.state;
  request.state = nextState;
  request.updatedAt = new Date().toISOString();
  request.history.push({ from: previousState, to: nextState, actor, reason, at: request.updatedAt });
}

async function executeWorkflow(input, config, request, audit) {
  transition(request, "PROCESSING", "workflow-engine", "Workflow execution started.");
  let attempt = 0;
  let finalEvaluation;

  while (attempt <= config.execution.maxRetries) {
    attempt += 1;
    request.attempts = attempt;
    const dependencies = await runDependencies(input);
    const evaluation = evaluateRules(input, config.rules, dependencies);
    finalEvaluation = { ...evaluation, dependencyDetails: dependencies.details, attempt };

    audit("RULES_EVALUATED", {
      attempt,
      outcome: evaluation.outcome,
      trace: evaluation.trace,
      dependencyDetails: dependencies.details
    });

    if (evaluation.outcome !== "RETRY") break;
    if (attempt <= config.execution.maxRetries) {
      transition(request, "PROCESSING", "retry-engine", `Retrying after attempt ${attempt}.`);
      audit("RETRY_SCHEDULED", { attempt, maxRetries: config.execution.maxRetries });
    }
  }

  let outcome = finalEvaluation.outcome;
  if (outcome === "RETRY") {
    outcome = "RETRY_EXHAUSTED";
    transition(request, outcome, "workflow-engine", "Retry limit exhausted.");
  } else {
    transition(request, outcome, "workflow-engine", `Decision completed: ${outcome}.`);
  }

  request.decision = {
    outcome,
    explanation: buildExplanation(finalEvaluation, outcome),
    ruleTrace: finalEvaluation.trace,
    dependencyDetails: finalEvaluation.dependencyDetails,
    evaluatedAt: new Date().toISOString(),
    configVersion: config.version,
    attempts: attempt
  };
  return request;
}

function buildExplanation(evaluation, outcome) {
  const failed = evaluation.trace.filter(x => !x.passed);
  if (outcome === "APPROVED") return "All configured checks passed; application approved.";
  if (outcome === "REJECTED") return failed.map(x => x.reason).join(" ") || "Application rejected by configured policy.";
  if (outcome === "MANUAL_REVIEW") return failed.map(x => x.reason).join(" ") || "Application requires manual review.";
  return `Dependency did not recover after ${evaluation.attempt} attempt(s).`;
}

module.exports = { executeWorkflow, transition, buildExplanation };
