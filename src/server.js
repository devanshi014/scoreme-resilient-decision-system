const { createApp } = require("./app");
const { JsonStore } = require("./store/jsonStore");
const config = require("./config");

(async () => {
  const store = await new JsonStore(config.dataDir).init();
  const app = await createApp({ store, configPath: config.workflowConfigPath });
  app.listen(config.port, () => console.log(`Decision System listening on http://localhost:${config.port}`));
})().catch(error => {
  console.error("Failed to start application:", error);
  process.exit(1);
});
