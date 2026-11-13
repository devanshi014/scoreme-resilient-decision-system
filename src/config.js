const path = require("node:path");

module.exports = {
  port: Number(process.env.PORT || 4000),
  dataDir: path.resolve(process.env.DATA_DIR || "./data"),
  workflowConfigPath: path.resolve("./config/application-approval.json")
};
