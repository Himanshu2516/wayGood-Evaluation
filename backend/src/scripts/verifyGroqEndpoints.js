const http = require("http");
const connectDatabase = require("../config/database");
const app = require("../app");
const env = require("../config/env");

async function verify() {
  console.log("=== VERIFYING AI ENDPOINTS WITH REAL REQUESTS ===");

  let usedMemoryServer = false;
  try {
    await connectDatabase();
  } catch (err) {
    console.log("[Info] External MongoDB connection unavailable (" + err.message + "). Using seeded in-memory database...");
    const { setupTestDB, seedTestDB } = require("../../tests/setup");
    await setupTestDB();
    await seedTestDB();
    usedMemoryServer = true;
  }

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    console.log("\nLogging in as aarav@example.com...");
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "aarav@example.com", password: "Candidate123!" }),
    });

    const loginData = await loginRes.json();
    if (!loginData.success || !loginData.data?.token) {
      throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
    }

    const token = loginData.data.token;
    console.log("Login successful! Token acquired.");

    console.log("\nCalling POST /api/ai/study-plan...");
    const planRes = await fetch(`${baseUrl}/ai/study-plan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });

    const planData = await planRes.json();
    console.log("Study Plan Status:", planRes.status);
    console.log("Study Plan Meta:", JSON.stringify(planData.meta, null, 2));
    console.log("Study Plan Summary:", planData.data?.studyPlan?.summary);
    console.log("Shortlist Count:", planData.data?.studyPlan?.shortlist?.length);
    if (planData.data?.studyPlan?.shortlist?.length) {
      console.log(
        "Shortlist Programs:",
        planData.data.studyPlan.shortlist.map((p) => `${p.programTitle} (${p.university})`)
      );
    }

    console.log("\nCalling POST /api/ai/recommendation-insights...");
    const insightsRes = await fetch(`${baseUrl}/ai/recommendation-insights`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });

    const insightsData = await insightsRes.json();
    console.log("Recommendation Insights Status:", insightsRes.status);
    console.log("Recommendation Insights Meta:", JSON.stringify(insightsData.meta, null, 2));
    console.log("Overall Advice:", insightsData.data?.overallAdvice);
    console.log("Insights Count:", insightsData.data?.insights?.length);
    if (insightsData.data?.insights?.length) {
      console.log(
        "Insights Programs:",
        insightsData.data.insights.map((i) => i.programTitle)
      );
    }

    console.log("\n=============================================");
    console.log("VERIFICATION RESULT SUMMARY:");
    console.log("POST /api/ai/study-plan meta.source:", planData.meta?.source, "model:", planData.meta?.model);
    console.log("POST /api/ai/recommendation-insights meta.source:", insightsData.meta?.source, "model:", insightsData.meta?.model);
    console.log("=============================================");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (usedMemoryServer) {
      const { teardownTestDB } = require("../../tests/setup");
      await teardownTestDB();
    } else {
      const mongoose = require("mongoose");
      await mongoose.disconnect();
    }
  }
}

verify().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
