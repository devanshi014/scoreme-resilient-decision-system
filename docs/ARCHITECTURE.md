# Architecture: Resilient Decision System

## 1. Scope and boundaries

The platform separates request intake, validation, rule evaluation, workflow orchestration, dependency simulation, persistence, and audit evidence. The sample business domain is application approval, but rule fields and outcomes are configuration-driven.

## 2. Components

- **REST/API layer**: accepts commands and exposes request, configuration and audit queries.
- **Validation layer**: validates shape and primitive constraints before any workflow state is created.
- **Workflow engine**: owns legal state transitions, retry loop and final outcome.
- **Rules engine**: interprets declarative operators and produces a trace for every rule.
- **Dependency adapter**: simulates identity verification and distinguishes transient outage from a negative verification result.
- **Store**: persists requests, idempotency mapping and audit events.
- **Configuration**: stores workflow metadata, rule definitions, precedence and retry policy outside application code.

## 3. Request data flow

1. Client submits an application with an idempotency key.
2. API validates the body. Invalid input returns HTTP 400 and is not admitted into workflow state.
3. The store checks the idempotency mapping. A replay returns the original result.
4. A new request is persisted in `RECEIVED` with an initial audit event.
5. Engine transitions it to `PROCESSING`.
6. Dependency adapter executes identity verification.
7. Rules engine evaluates configured rules and emits a per-rule trace.
8. A retryable dependency failure causes another attempt up to the configured limit.
9. The engine persists a terminal decision state and explanation.
10. Client can retrieve state history and audit events independently.

## 4. State model

`RECEIVED -> PROCESSING -> APPROVED | REJECTED | MANUAL_REVIEW | RETRY_EXHAUSTED`

A retry remains in `PROCESSING` and is represented by attempt metadata and audit events. Every transition records previous state, next state, actor, reason and timestamp.

## 5. Rule configuration model

Each rule contains:
- `id`, `name`, `type`
- `field` and `operator` for data rules, or `dependency` for external checks
- `value` for comparison rules
- `failureOutcome`
- `reason` used in the explainability response

The configuration also includes a workflow version and `execution.maxRetries`. A rule threshold can therefore change without modifying the evaluator.

## 6. Failure handling

- **Invalid input**: rejected before workflow admission.
- **Duplicate request**: idempotency key returns original request.
- **Transient dependency outage**: bounded retries; final state is `RETRY_EXHAUSTED`.
- **Permanent identity negative**: identity dependency returns false with a non-retryable result and is routed to manual review; transient provider outage is retried.
- **Persistence failure**: API returns an error; production design should use a transactional database and outbox so state and audit cannot diverge.
- **Unexpected exception**: generic 500 response; detailed error is not exposed to clients.

## 7. Auditability and explainability

Each audit event contains request ID, event name, timestamp and structured data. `RULES_EVALUATED` includes the rule trace, actual values, expected values, pass/fail and failure reasons. The decision object stores its explanation, config version and number of attempts.

## 8. Trade-offs

- **JSON file store vs database**: JSON persistence avoids setup friction and is transparent for a time-boxed demo. It is single-process only and does not provide cross-process transactions or robust concurrent writes. A relational/document database with unique constraints is the production replacement.
- **Synchronous workflow vs queue**: synchronous execution keeps the demo easy to run and inspect. Long-running workflows should use a durable queue and return `202 Accepted`.
- **Simple bounded retries vs exponential backoff**: immediate retries make failure behavior reproducible in a hackathon. Production should use exponential backoff, jitter, timeout budgets and circuit breakers.
- **Config file vs workflow administration service**: a versioned JSON config is simple and auditable. Production needs schema validation, approval/version rollout and rollback.

## 9. Scaling plan

Use stateless API instances; store workflow state and audit in a shared database; enforce unique idempotency constraints; publish state changes through an outbox; dispatch workflow stages to durable workers; partition audit data by tenant/time; cache immutable config versions; add metrics for stage latency, retry rate, failure rate and manual-review backlog.
