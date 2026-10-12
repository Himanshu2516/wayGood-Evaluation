const http = require("http");
const connectDatabase = require("../config/database");
const app = require("../app");
const express = require("express");
const { createRateLimiter } = require("../middleware/rateLimiter");

async function runTests() {
  console.log("=== BONUS TASK: AI STUDY PLANNING & RECOMMENDATIONS (GROQ API) ===");

  let usedMemoryServer = false;
  try {
    await connectDatabase();
  } catch (err) {
    console.log("[Info] External MongoDB connection unavailable (" + err.message + "). Using test memory database...");
    const { setupTestDB, seedTestDB } = require("../../tests/setup");
    await setupTestDB();
    await seedTestDB();
    usedMemoryServer = true;
  }

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  console.log(`Test server running at ${baseUrl}\n`);

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = "") {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} ${details ? "- " + details : ""}`);
      failed++;
    }
  }

  try {
    console.log("--- 1. Authenticating as Student (aarav@example.com) ---");
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "aarav@example.com", password: "Candidate123!" }),
    });
    assert(loginRes.status === 200, "POST /api/auth/login returns 200 OK");
    const loginData = await loginRes.json();
    const studentToken = loginData.data?.token;
    assert(Boolean(studentToken), "Valid JWT token obtained for student");

    console.log("\n--- 2. Testing POST /api/ai/study-plan Output Schema ---");
    const studyPlanRes = await fetch(`${baseUrl}/ai/study-plan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({}),
    });

    assert(studyPlanRes.status === 200, "POST /api/ai/study-plan returns HTTP 200 OK");
    const studyPlanData = await studyPlanRes.json();
    assert(studyPlanData.success === true, "Response format contains success: true");
    assert(Boolean(studyPlanData.data?.studyPlan), "Response contains data.studyPlan");
    assert(Boolean(studyPlanData.meta), "Response contains meta");
    assert(
      ["groq", "groq-backup", "fallback"].includes(studyPlanData.meta?.source),
      `meta.source is valid (${studyPlanData.meta?.source})`
    );

    const plan = studyPlanData.data.studyPlan;

    assert(typeof plan.summary === "string" && plan.summary.length > 0, "studyPlan.summary is a non-empty string");

    assert(Array.isArray(plan.shortlist), "studyPlan.shortlist is an Array");
    assert(plan.shortlist.length >= 1, "Shortlist contains programs");
    assert(
      Boolean(plan.shortlist[0].programTitle) &&
      Boolean(plan.shortlist[0].university) &&
      Boolean(plan.shortlist[0].reason) &&
      Boolean(plan.shortlist[0].risk) &&
      typeof plan.shortlist[0].tuitionFeeUsd === "number" &&
      typeof plan.shortlist[0].ieltsGap === "number",
      "Shortlist item contains programTitle, university, reason, risk, tuitionFeeUsd, and ieltsGap"
    );

    assert(Array.isArray(plan.timeline), "studyPlan.timeline is an Array");
    assert(plan.timeline.length >= 1, "Timeline contains structured steps");
    assert(
      typeof plan.timeline[0].month === "string" && typeof plan.timeline[0].task === "string",
      "Timeline item contains month and task strings"
    );

    assert(Array.isArray(plan.documentsChecklist), "studyPlan.documentsChecklist is an Array");
    assert(plan.documentsChecklist.length >= 1, "Checklist contains required documents");
    assert(typeof plan.documentsChecklist[0] === "string", "Checklist items are strings");

    assert(typeof plan.budgetNotes === "string" && plan.budgetNotes.length > 0, "studyPlan.budgetNotes is a string");
    assert(Array.isArray(plan.nextSteps) && plan.nextSteps.length >= 1, "studyPlan.nextSteps is an Array of actions");

    console.log("\n--- 3. Testing POST /api/ai/recommendation-insights Output Schema ---");
    const insightsRes = await fetch(`${baseUrl}/ai/recommendation-insights`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({}),
    });

    assert(insightsRes.status === 200, "POST /api/ai/recommendation-insights returns HTTP 200 OK");
    const insightsData = await insightsRes.json();
    assert(insightsData.success === true, "Insights response format contains success: true");
    assert(Array.isArray(insightsData.data?.insights), "Response contains data.insights array");
    assert(typeof insightsData.data?.overallAdvice === "string", "Response contains data.overallAdvice string");
    assert(
      ["groq", "groq-backup", "fallback"].includes(insightsData.meta?.source),
      `meta.source is valid (${insightsData.meta?.source})`
    );

    if (insightsData.data.insights.length > 0) {
      const firstInsight = insightsData.data.insights[0];
      assert(
        Boolean(firstInsight.programTitle) && Boolean(firstInsight.whyItFits) && Boolean(firstInsight.watchOut),
        "Insight item contains programTitle, whyItFits, and watchOut",
        JSON.stringify(firstInsight)
      );
    }

    console.log("\n--- 4. Testing Unauthenticated Access (401) ---");
    const unauthRes = await fetch(`${baseUrl}/ai/study-plan`, { method: "POST" });
    assert(unauthRes.status === 401, "Unauthenticated request returns HTTP 401 Unauthorized");

    console.log("\n--- 5. Testing AI Rate Limiting ---");
    const rateLimitTestApp = express();
    const testLimiter = createRateLimiter({
      windowMs: 60 * 1000,
      max: 2,
      message: "Too many AI study plan generation requests, please try again later.",
    });
    rateLimitTestApp.post("/ai/study-plan", testLimiter, (req, res) => res.json({ success: true }));
    const rateLimitServer = http.createServer(rateLimitTestApp);
    await new Promise((resolve) => rateLimitServer.listen(0, resolve));
    const rateLimitPort = rateLimitServer.address().port;

    await fetch(`http://127.0.0.1:${rateLimitPort}/ai/study-plan`, { method: "POST" });
    await fetch(`http://127.0.0.1:${rateLimitPort}/ai/study-plan`, { method: "POST" });

    const blockedRes = await fetch(`http://127.0.0.1:${rateLimitPort}/ai/study-plan`, {
      method: "POST",
    });
    assert(blockedRes.status === 429, "Rate limiter returns HTTP 429 when threshold exceeded");
    const blockedData = await blockedRes.json();
    assert(
      blockedData.message === "Too many AI study plan generation requests, please try again later.",
      "429 response message informs user of rate limit"
    );
    await new Promise((resolve) => rateLimitServer.close(resolve));

  } catch (err) {
    console.error("Test execution failed:", err);
    failed++;
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

  console.log("\n========================================");
  console.log(`TOTAL AI TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log("========================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
