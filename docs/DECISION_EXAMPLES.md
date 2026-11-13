# Decision explanation examples

## Example A: Approved

**Input:** age 25, monthly income 50,000, debt-to-income 0.25, identity provider succeeds.

**Rules:** R001 name present (pass); R002 age >= 18 (pass); R003 income >= 25,000 (pass); R004 debt-to-income <= 0.45 (pass); R005 identity verified (pass).

**Output:** `APPROVED`

**Explanation:** All configured checks passed; application approved.

## Example B: Manual review

**Input:** age 25, monthly income 20,000, debt-to-income 0.25, identity provider succeeds.

**Triggered rule:** R003 income >= 25,000 (fail).

**Output:** `MANUAL_REVIEW`

**Explanation:** Income is below the configured threshold.

## Example C: Rejected

**Input:** age 16, monthly income 50,000, debt-to-income 0.25, identity provider succeeds.

**Triggered rule:** R002 age >= 18 (fail).

**Output:** `REJECTED`

**Explanation:** Applicant must be at least 18 years old.

## Example D: Retry exhausted

**Input:** valid applicant and financial details, `simulateDependencyFailure=true`, maxRetries=2.

**Triggered rule:** R005 identity dependency unavailable on each attempt.

**Output:** `RETRY_EXHAUSTED`

**Explanation:** Dependency did not recover after 3 attempt(s).
