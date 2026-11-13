# Resilient Decision System

A configurable workflow decision platform built for the ScoreMe Hackathon Assignment — **Design and Build a Resilient Decision System**.

The system processes structured applications, validates incoming requests, evaluates configuration-driven business rules, executes workflow stages, maintains application state, handles dependency failures and retries, and records explainable audit trails.

It is designed to support changing business requirements through configuration rather than major code modifications.

## Key Features

- **Configurable Rule Engine:** Supports mandatory checks, threshold-based rules, conditional outcomes, and multiple rule evaluations.
- **Workflow Management:** Supports APPROVED, REJECTED, MANUAL_REVIEW, RETRY, and RETRY_EXHAUSTED states.
- **Input Validation:** Validates application requests using Zod schemas.
- **Idempotency:** Prevents duplicate workflow execution for repeated requests.
- **Failure Handling:** Simulates external identity verification failures and supports configurable retries.
- **Audit Logging:** Records request events, rule evaluations, dependency evidence, retry attempts, and decision reasoning.
- **State Management:** Maintains application lifecycle history and decision details.
- **Configuration Management:** Allows workflow rules and retry settings to be modified without changing engine code.
- **Scalability Considerations:** Documents the transition from lightweight JSON persistence to production-grade database and queue-based architecture.

## Tech Stack

| Technology | Purpose |
|---|---|
| Node.js 20+ | Runtime environment |
| Express.js | REST API |
| Zod | Request validation |
| JSON | Workflow and rule configuration |
| JSON File Store | Application and audit persistence |
| Node.js Test Runner | Automated testing |

## Project Structure

```text
scoreme-resilient-decision-system/
│
├── config/
│   └── application-approval.json
│
├── docs/
│   ├── ARCHITECTURE.md
│   └── DECISION_EXAMPLES.md
│
├── src/
│   ├── engine/
│   │   ├── dependency.js
│   │   ├── rules.js
│   │   └── workflow.js
│   │
│   ├── routes/
│   │   └── workflows.js
│   │
│   ├── store/
│   │   └── jsonStore.js
│   │
│   ├── app.js
│   ├── config.js
│   ├── server.js
│   └── validation.js
│
├── test/
│   ├── rules.test.js
│   ├── validation.test.js
│   └── workflow.test.js
│
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
└── README.md
```

## Installation and Setup

### Prerequisites

- Node.js 20 or later
- npm

### 1. Clone the repository

```bash
git clone https://github.com/devanshi014/scoreme-resilient-decision-system.git
cd scoreme-resilient-decision-system
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the server

```bash
npm start
```

The server runs at:

```text
http://localhost:4000
```

### 4. Check server health

```bash
curl http://localhost:4000/health
```

## REST API Documentation

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Check server health |
| GET | `/api/config` | Retrieve active workflow configuration |
| PUT | `/api/config` | Update workflow and rule configuration |
| POST | `/api/applications` | Submit and process an application |
| GET | `/api/applications` | List processed applications |
| GET | `/api/applications/:id` | Retrieve application details and state history |
| GET | `/api/applications/:id/audit` | Retrieve application audit events |

### Submit an Application

**Endpoint:** `POST /api/applications`

**Headers:**

```text
Content-Type: application/json
Idempotency-Key: APP-1001
```

**Sample Request:**

```json
{
  "applicationId": "APP-1001",
  "applicant": {
    "name": "Aarav Sharma",
    "age": 25,
    "monthlyIncome": 50000,
    "identityVerified": true
  },
  "financial": {
    "debtToIncome": 0.25
  }
}
```

**Sample Response (illustrative):**

```json
{
  "applicationId": "APP-1001",
  "state": "APPROVED",
  "attempts": 1,
  "history": [
    "RECEIVED",
    "PROCESSING",
    "APPROVED"
  ],
  "idempotentReplay": false
}
```

The actual API response also provides decision explanation, rule evaluation details, and dependency evidence.

### Retrieve Application Details

**Endpoint:**

```http
GET /api/applications/APP-1001
```

Returns the application's current state, decision information, and lifecycle history.

### Retrieve Audit Logs

**Endpoint:**

```http
GET /api/applications/APP-1001/audit
```

Returns recorded audit events, including request receipt, rule evaluations, dependency results, retry evidence, and decision outcomes.

## Workflow Decision States

The decision engine supports the following outcomes:

| State | Description |
|---|---|
| APPROVED | All configured rules pass successfully. |
| REJECTED | A mandatory or policy rule fails with a rejection outcome. |
| MANUAL_REVIEW | A threshold or policy failure requires human judgement. |
| RETRY | A retryable external dependency fails temporarily. |
| RETRY_EXHAUSTED | The dependency remains unavailable after all configured retry attempts. |

### Example Rule Evaluation

The default application approval workflow evaluates:

| Rule ID | Condition | Failure Outcome |
|---|---|---|
| R001 | Applicant name must not be empty | REJECTED |
| R002 | Applicant age must be at least 18 | REJECTED |
| R003 | Monthly income must be at least 25,000 | MANUAL_REVIEW |
| R004 | Debt-to-income ratio must not exceed 0.45 | MANUAL_REVIEW |
| R005 | Identity verification must succeed | RETRY or MANUAL_REVIEW depending on failure type |

The engine evaluates configured rules and determines the final outcome using the configured decision precedence.

## Dependency Failure Simulation and Retry Handling

The project includes a simulated external identity verification dependency.

To simulate a temporary dependency outage, include:

```json
{
  "simulateDependencyFailure": true
}
```

The identity verification simulator returns a retryable failure.

With the default configuration:

```json
{
  "maxRetries": 2,
  "retryDelayMs": 0
}
```

The workflow performs:

1. Initial execution attempt.
2. First retry after temporary failure.
3. Second retry after another temporary failure.
4. RETRY_EXHAUSTED if the dependency remains unavailable.

Non-retryable identity verification failures are routed to MANUAL_REVIEW rather than repeatedly retried.

## Idempotency and Duplicate Request Handling

The API uses the `Idempotency-Key` request header to identify logical requests.

Example:

```text
Idempotency-Key: APP-1001
```

If the same key is submitted again, the system returns the original result without executing the workflow again.

If the header is omitted, the application ID is used as the idempotency key.

A duplicate application ID submitted with a different key is rejected.

This prevents duplicate processing and supports reliable request handling.

## Configuration-Driven Workflow

Workflow behavior is controlled through:

```text
config/application-approval.json
```

The configuration defines:

- Workflow ID and version.
- Initial workflow state.
- Rule definitions and conditions.
- Rule failure outcomes.
- Decision precedence.
- Retry limits and retry delays.

The configuration can also be retrieved and updated through:

```http
GET /api/config
PUT /api/config
```

For example, the minimum monthly income threshold can be changed by modifying the value associated with rule `R003`.

This allows business requirements to evolve without requiring changes to the underlying rule engine.

Supported rule operators include:

- `notEmpty`
- `eq`
- `neq`
- `gt`
- `gte`
- `lt`
- `lte`
- `in`

Rule IDs must be unique, and `maxRetries` must be between 0 and 10.

## Automated Testing

Run the complete test suite:

```bash
npm test
```

The automated test suite contains 12 tests covering:

1. Valid application approval.
2. Mandatory rule failures.
3. Threshold-based manual review routing.
4. Invalid input and unexpected fields.
5. API validation before workflow creation.
6. Idempotency and duplicate request handling.
7. Duplicate application ID rejection.
8. Transient dependency failure and retry exhaustion.
9. Non-retryable identity verification failure.
10. Configuration-driven rule changes.
11. Audit endpoint and rule trace verification.
12. Retry evidence and decision consistency.

**Latest verified test result:**

```text
Tests: 12
Passed: 12
Failed: 0
```

## Persistence and Architecture Decisions

The project uses a lightweight JSON file-backed store to keep the implementation easy to run without requiring an external database.

The store uses temporary-file writing followed by atomic rename when committing snapshots.

This approach is suitable for a single-process hackathon demonstration but is not intended for multi-instance production deployment.

### Production Scaling Considerations

For a production environment, the following improvements are recommended:

1. Replace JSON persistence with PostgreSQL or MongoDB.
2. Add unique database indexes for tenant-scoped idempotency keys and application IDs.
3. Use database transactions and the transactional outbox pattern for consistent state and audit updates.
4. Introduce a durable message queue such as BullMQ, RabbitMQ, or Kafka for asynchronous workflow stages.
5. Implement bounded exponential backoff with jitter, circuit breakers, timeouts, and dead-letter queues.
6. Add tenant-scoped authorization, rate limiting, structured logging, metrics, and distributed tracing.
7. Version workflow configurations and associate each request with the configuration version used during evaluation.

## Documentation

Detailed design documentation is available in the `docs/` directory:

- [Architecture Document](docs/ARCHITECTURE.md) — System components, architecture, data flow, assumptions, and trade-offs.
- [Decision Examples](docs/DECISION_EXAMPLES.md) — Example inputs, triggered rules, final decisions, and audit reasoning.

## Author

**Devanshi**  
MNNIT Allahabad

GitHub: [@devanshi014](https://github.com/devanshi014)
