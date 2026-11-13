const fs = require("node:fs/promises");
const path = require("node:path");

class JsonStore {
  constructor(directory) {
    this.directory = directory;
    this.file = path.join(directory, "state.json");
    this.state = { requests: {}, idempotency: {}, audit: [] };
    this.writeQueue = Promise.resolve();
  }

  async init() {
    await fs.mkdir(this.directory, { recursive: true });
    try {
      this.state = JSON.parse(await fs.readFile(this.file, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await this.persist();
    }
    return this;
  }

  async persist() {
    const snapshot = JSON.stringify(this.state, null, 2);
    this.writeQueue = this.writeQueue.then(async () => {
      const temp = `${this.file}.tmp`;
      await fs.writeFile(temp, snapshot, "utf8");
      await fs.rename(temp, this.file);
    });
    return this.writeQueue;
  }

  async transaction(mutator) {
    const run = this.writeQueue.then(async () => {
      const result = await mutator(this.state);
      const snapshot = JSON.stringify(this.state, null, 2);
      const temp = `${this.file}.tmp`;
      await fs.writeFile(temp, snapshot, "utf8");
      await fs.rename(temp, this.file);
      return result;
    });
    // Keep the queue usable after a failed operation while returning the real error to caller.
    this.writeQueue = run.catch(() => {});
    return run;
  }

  getRequest(id) { return this.state.requests[id] || null; }
  listRequests() { return Object.values(this.state.requests); }
  getAudit(id) { return this.state.audit.filter(x => x.requestId === id); }
}

module.exports = { JsonStore };
