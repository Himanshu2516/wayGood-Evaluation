const app = require("./app");
const connectDatabase = require("./config/database");
const env = require("./config/env");
const logger = require("./utils/logger");
const { seedDatabase } = require("./scripts/seed");

async function startServer() {
  await connectDatabase();

  if (env.autoSeed) {
    try {
      await seedDatabase({ force: env.forceSeed });
    } catch (seedErr) {
      logger.error("Auto-seed encountered an error", { error: seedErr.message });
    }
  }

  app.listen(env.port, () => {
    logger.info(`Waygood evaluation API running on port ${env.port}`, { port: env.port });
  });
}

startServer().catch((error) => {
  logger.error("Failed to start server", { error: error.message });
  process.exit(1);
});
