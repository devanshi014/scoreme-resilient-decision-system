const express = require("express");
const fs = require("node:fs/promises");
const { createRouter } = require("./routes/workflows");

async function createApp({ store, configPath }) {
  let config = JSON.parse(await fs.readFile(configPath, "utf8"));
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.get("/health", (_req, res) => res.json({ status: "ok", service: "resilient-decision-system" }));
  app.use("/api", createRouter({
    store, configPath,
    getConfig: () => config,
    setConfig: next => { config = next; }
  }));
  app.use((error, _req, res, _next) => {
    res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." });
  });
  return app;
}

module.exports = { createApp };
