// Deterministic simulator: set simulateDependencyFailure=true to force a transient outage.
async function verifyIdentity(input) {
  if (input.simulateDependencyFailure === true) {
    return { ok: false, code: "IDENTITY_PROVIDER_UNAVAILABLE", retryable: true };
  }
  if (input.applicant && input.applicant.identityVerified === false) {
    return { ok: false, code: "IDENTITY_NOT_VERIFIED", retryable: false };
  }
  return { ok: true, reference: `IDV-${input.applicationId}` };
}

async function runDependencies(input) {
  const result = await verifyIdentity(input);
  return {
    identity: result.ok,
    identityFailureOutcome: result.retryable ? "RETRY" : "MANUAL_REVIEW",
    details: { identity: result }
  };
}

module.exports = { runDependencies };
