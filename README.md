# Resilient Decision System

A configurable workflow decision platform built for the ScoreMe hackathon assignment. It accepts structured applications, validates input, evaluates configuration-driven rules, executes approval/rejection/manual-review/retry paths, persists lifecycle state, and records an explainable audit trail.

## Tech stack

- Node.js 20+
- Express REST API
- Zod request validation
- JSON file-backed persistence (atomic temp-file rename for each committed snapshot)
- Node's built-in test runner

## Quick start

```bash
npm install
npm start
```

Server: `http://localhost:4000`

```bash
curl http://localhost:4000/health
```

## Submit an application

```bash
curl -X POST http://localhost:4000/api/applications \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: APP-1001" \
  -d '{
    "applicationId": "APP-1001",
    "applicant": {
      "name": "Aarav Sharma",
      "age": 25,
      "monthlyIncome": 50000,
      "identityVerified": true
    },
    "financial": { "debtToIncome": 0.25 }
  }'
```

The API returns the complete request lifecycle, final decision, rule trace, dependency evidence, and attempt count.

## API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/api/config` | Read active workflow configuration |
| PUT | `/api/config` | Replace workflow/rule configuration |
| POST | `/api/applications` | Validate and execute a request |
| GET | `/api/applications` | List requests |
| GET | `/api/applications/:id` | Get request, state history and decision |
| GET | `/api/applications/:id/audit` | Get append-only audit events |

## Decision paths

- **APPROVED**: all configured rules pass.
- **REJECTED**: a mandatory/policy rule fails with rejection outcome.
- **MANUAL_REVIEW**: a configurable threshold or policy requires human judgement.
- **RETRY**: a retryable dependency is unavailable; the engine retries up to `execution.maxRetries`.
- **RETRY_EXHAUSTED**: dependency remains unavailable after the configured retry limit.

## Simulate dependency failure

Send `simulateDependencyFailure: true`. The identity provider simulator returns a retryable outage. With `maxRetries: 2`, the engine makes up to three attempts (initial attempt plus two retries), then records `RETRY_EXHAUSTED`.

## Idempotency

The `Idempotency-Key` header identifies a logical request. If omitted, `applicationId` is used. Replaying the same key returns the original request and does not execute the workflow again.

## Configuration-driven rules

Edit `config/application-approval.json` or update it through `PUT /api/config`. Rule IDs must be unique and `maxRetries` must be between 0 and 10. Rules support `notEmpty`, `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, and `in`.

Example: change the income threshold by updating `R003.value`; no engine code change is required.

## Tests

```bash
npm test
```

Tests currently cover valid and invalid input, rule pass/fail, rejection and manual-review routing. The next hardening step is adding HTTP integration tests for duplicate requests, retry exhaustion, config updates, and audit consistency.

## Persistence and operational assumptions

The included JSON store is intentionally lightweight and makes the project runnable without provisioning a database. It writes snapshots through a temporary file followed by rename. It is suitable for a single-process hackathon demonstration, not multi-instance production use.

For production scale:
1. Replace `JsonStore` with a repository backed by PostgreSQL or MongoDB.
2. Add unique indexes on `(tenant_id, idempotency_key)` and `(tenant_id, application_id)`.
3. Use database transactions/outbox pattern for state changes and audit events.
4. Use a durable queue (e.g. BullMQ/RabbitMQ/Kafka) for asynchronous stages and delayed retries.
5. Apply bounded exponential backoff with jitter, circuit breakers, timeouts and dead-letter queues.
6. Add tenant-scoped authorization, rate limiting, structured logs, metrics and distributed tracing.
7. Version workflow configuration and pin each request to the config version used at evaluation time.

## Architecture and detailed trade-offs

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
