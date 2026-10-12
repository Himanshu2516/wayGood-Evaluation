const dotenv = require("dotenv");
const path = require("path");
const mongoose = require("mongoose");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const env = require("../config/env");
const { seedDatabase } = require("./seed");

async function testConnection() {
  console.log("=== TESTING MONGODB ATLAS CONNECTION ===");
  try {
    mongoose.set("strictQuery", true);
    await mongoose.connect(env.mongoUri);
    console.log("SUCCESS: Connected to MongoDB Atlas!");
    console.log("Database Name:", mongoose.connection.name);
    console.log("ReadyState:", mongoose.connection.readyState);

    console.log("\nExecuting seed on MongoDB Atlas...");
    const result = await seedDatabase({ force: true });
    console.log("Seed result:", result.seeded ? "SEEDED SUCCESSFULLY" : "SKIPPED");
    console.log("Seeded Counts:", JSON.stringify(result.counts));

    await mongoose.disconnect();
    console.log("Disconnected cleanly.");
    process.exit(0);
  } catch (err) {
    console.error("FAILURE: Could not connect or seed Atlas database.");
    console.error("Error Name:", err.name);
    console.error("Error Message:", err.message);
    process.exit(1);
  }
}

testConnection();
