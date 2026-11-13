const express = require("express");
const fs = require("node:fs/promises");
const { applicationSchema } = require("../validation");
const { executeWorkflow } = require("../engine/workflow");

function createRouter({ store, configPath, getConfig, setConfig }) {
  const router = express.Router();

  router.get("/config", (_req, res) => res.json(getConfig()));

  router.put("/config", async (req, res) => {
    const candidate = req.body;
    if (!candidate || !Array.isArray(candidate.rules) || !candidate.execution ||
        !Number.isInteger(candidate.execution.maxRetries) || candidate.execution.maxRetries < 0 ||
        candidate.execution.maxRetries > 10) {
      return res.status(400).json({ error: "Invalid workflow configuration." });
    }
    const ids = candidate.rules.map(r => r.id);
    if (new Set(ids).size !== ids.length) return res.status(400).json({ error: "Rule IDs must be unique." });
    try {
      await fs.writeFile(configPath, JSON.stringify(candidate, null, 2));
      setConfig(candidate);
      return res.json({ message: "Workflow configuration updated.", version: candidate.version });
    } catch {
      return res.status(500).json({ error: "Unable to persist workflow configuration." });
    }
  });

  router.post("/applications", async (req, res, next) => {
    const parsed = applicationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "INVALID_INPUT",
        message: "Request body failed schema validation.",
        details: parsed.error.issues.map(i => ({ path: i.path.join("."), message: i.message }))
      });
    }

    const input = parsed.data;
    const idempotencyKey = req.header("Idempotency-Key") || input.applicationId;
    try {
      const existingId = store.state.idempotency[idempotencyKey];
      if (existingId) {
        const existing = store.getRequest(existingId);
        return res.status(200).json({ ...existing, idempotentReplay: true });
      }

      const now = new Date().toISOString();
      const request = {
        id: input.applicationId,
        applicationId: input.applicationId,
        state: "RECEIVED",
        createdAt: now,
        updatedAt: now,
        attempts: 0,
        history: [{ from: null, to: "RECEIVED", actor: "api", reason: "Request accepted.", at: now }],
        input
      };

      const admission = await store.transaction(state => {
        // Re-check inside the serialized mutation to prevent duplicate-key races in this process.
        const raced = state.idempotency[idempotencyKey];
        if (raced) return { kind: "replay", requestId: raced };
        if (state.requests[request.id]) return { kind: "duplicate_application" };
        state.idempotency[idempotencyKey] = request.id;
        state.requests[request.id] = request;
        state.audit.push({
          id: `${request.id}-A1`, requestId: request.id, event: "REQUEST_RECEIVED",
          timestamp: now, data: { idempotencyKey, configVersion: getConfig().version }
        });
        return { kind: "created", requestId: request.id };
      });

      if (admission.kind === "replay") {
        return res.status(200).json({ ...store.getRequest(admission.requestId), idempotentReplay: true });
      }
      if (admission.kind === "duplicate_application") {
        return res.status(409).json({ error: "DUPLICATE_APPLICATION", message: "An application with this applicationId already exists." });
      }

      const audit = (event, data) => {
        store.state.audit.push({
          id: `${request.id}-A${store.state.audit.filter(x => x.requestId === request.id).length + 1}`,
          requestId: request.id, event, timestamp: new Date().toISOString(), data
        });
      };

      await executeWorkflow(input, getConfig(), request, audit);
      await store.transaction(() => {});
      return res.status(201).json(request);
    } catch (error) {
      next(error);
    }
  });

  router.get("/applications", (_req, res) => {
    res.json(store.listRequests().map(({ input, ...safe }) => safe));
  });

  router.get("/applications/:id", (req, res) => {
    const request = store.getRequest(req.params.id);
    if (!request) return res.status(404).json({ error: "NOT_FOUND" });
    res.json(request);
  });

  router.get("/applications/:id/audit", (req, res) => {
    if (!store.getRequest(req.params.id)) return res.status(404).json({ error: "NOT_FOUND" });
    res.json(store.getAudit(req.params.id));
  });

  return router;
}

module.exports = { createRouter };
