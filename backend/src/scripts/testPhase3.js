const connectDatabase = require("../config/database");
const app = require("../app");
const mongoose = require("mongoose");
const http = require("http");
const Student = require("../models/Student");

async function runTests() {
  console.log("=== PHASE 3 RECOMMENDATION ENGINE VERIFICATION SUITE ===");

  await connectDatabase();

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
    console.log("--- 1. Authenticating Seeded Candidate ---");
    const aaravLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "aarav@example.com", password: "Candidate123!" }),
    });
    const aaravLogin = await aaravLoginRes.json();
    const aaravId = aaravLogin.data.user._id;
    const aaravToken = aaravLogin.data.token;
    assert(Boolean(aaravId), "Retrieved Aarav's student ID");

    console.log("\n--- 2. Testing Recommendations via MongoDB Aggregation ---");
    const recRes = await fetch(`${baseUrl}/recommendations/${aaravId}`);
    const recData = await recRes.json();
    assert(recRes.status === 200, "GET /recommendations/:studentId returns HTTP 200");
    assert(recData.success === true, "Response success === true");
    assert(recData.meta?.engine === "mongodb-aggregation", "Engine is mongodb-aggregation");
    assert(recData.meta?.maxPossibleScore === 100, "Scoring breakdown reflects max 100 points");
    assert(recData.data?.student?.fullName === "Aarav Malhotra", "Student profile returned in response");
    assert(Array.isArray(recData.data?.recommendations), "Recommendations is an array");
    assert(recData.data.recommendations.length > 0, "Found program recommendations for Aarav");

    console.log("\n--- 3. Verifying Aggregation Scoring & Match Reasons ---");
    const topMatch = recData.data.recommendations[0];
    console.log(`Top match: "${topMatch.title}" at "${topMatch.university.name}" - Score: ${topMatch.score}`);
    console.log("Match reasons:", topMatch.matchReasons);

    assert(typeof topMatch.score === "number", "Recommendation contains numeric score");
    assert(topMatch.score > 0, "Top recommendation score > 0");
    assert(Array.isArray(topMatch.matchReasons), "Recommendation has matchReasons array");
    assert(topMatch.matchReasons.length > 0, "Top recommendation has at least 1 matchReason");

    const hasCountryReason = topMatch.matchReasons.some((r) => r.includes("Preferred study destination"));
    const hasBudgetReason = topMatch.matchReasons.some((r) => r.includes("Within tuition budget"));
    assert(hasCountryReason, "Country match reason present");
    assert(hasBudgetReason, "Budget feasibility match reason present");

    assert(Boolean(topMatch.university?.name), "$lookup populated university name");
    assert(typeof topMatch.university?.qsRanking === "number", "$lookup populated university qsRanking");

    let scoresDescending = true;
    for (let i = 1; i < recData.data.recommendations.length; i++) {
      if (recData.data.recommendations[i].score > recData.data.recommendations[i - 1].score) {
        scoresDescending = false;
        break;
      }
    }
    assert(scoresDescending, "Recommendations correctly sorted by score descending");

    console.log("\n--- 4. Testing Recommendation Limit Parameter ---");
    const limitRes = await fetch(`${baseUrl}/recommendations/${aaravId}?limit=2`);
    const limitData = await limitRes.json();
    assert(limitData.data.recommendations.length === 2, "limit=2 returns exactly 2 recommendations");

    console.log("\n--- 5. Testing Authenticated GET /recommendations (Bearer Token) ---");
    const authRecRes = await fetch(`${baseUrl}/recommendations`, {
      headers: { Authorization: `Bearer ${aaravToken}` },
    });
    const authRecData = await authRecRes.json();
    assert(authRecRes.status === 200, "Authenticated GET /recommendations HTTP 200");
    assert(authRecData.data?.student?.id === aaravId, "Correct student inferred from auth token");

    console.log("\n--- 6. Testing Recommendations for Second Candidate (Sara) ---");
    const sara = await Student.findOne({ email: "sara@example.com" });
    const saraRecRes = await fetch(`${baseUrl}/recommendations/${sara._id}`);
    const saraRecData = await saraRecRes.json();
    assert(saraRecRes.status === 200, "GET /recommendations for Sara HTTP 200");
    const saraTop = saraRecData.data.recommendations[0];
    console.log(`Sara top match: "${saraTop.title}" in ${saraTop.country} - Score: ${saraTop.score}`);
    assert(["UK", "Australia"].includes(saraTop.country), "Sara's top program is in her preferred countries");

    console.log("\n--- 7. Testing Graceful Handling for Empty Profile ---");
    const emptyStudent = await Student.create({
      fullName: "Blank Profile Student",
      email: `blank_${Date.now()}@example.com`,
      password: "Candidate123!",
      role: "student",
      preferredCountries: [],
      budget: 0,
      fieldOfStudy: [],
      intake: "",
      ieltsScore: 0,
    });

    const emptyRecRes = await fetch(`${baseUrl}/recommendations/${emptyStudent._id}`);
    const emptyRecData = await emptyRecRes.json();
    assert(emptyRecRes.status === 200, "Recommendations for student with missing fields returns HTTP 200");
    assert(Array.isArray(emptyRecData.data.recommendations), "Returns recommendations array without errors");
    assert(emptyRecData.data.recommendations.length > 0, "Returns fallback programs for empty profile");
    const emptyTop = emptyRecData.data.recommendations[0];
    assert(
      emptyTop.matchReasons.includes("Popular program worldwide"),
      "Fallback reason 'Popular program worldwide' provided when no fields match"
    );

    console.log("\n--- 8. Testing Edge Cases & Error Handling ---");
    const badIdRes = await fetch(`${baseUrl}/recommendations/invalid-mongo-id`);
    assert(badIdRes.status === 400, "Invalid student ID HTTP 400");

    const nonExistentId = new mongoose.Types.ObjectId().toString();
    const notFoundRes = await fetch(`${baseUrl}/recommendations/${nonExistentId}`);
    assert(notFoundRes.status === 404, "Non-existent student ID HTTP 404");

    const noParamNoAuthRes = await fetch(`${baseUrl}/recommendations`);
    assert(noParamNoAuthRes.status === 400, "Missing studentId and no auth token HTTP 400");

    await Student.findByIdAndDelete(emptyStudent._id);

    console.log(`\n========================================`);
    console.log(`TOTAL PHASE 3 TESTS: ${passed + failed}`);
    console.log(`PASSED: ${passed}`);
    console.log(`FAILED: ${failed}`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Test execution error:", error);
    process.exit(1);
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runTests();
