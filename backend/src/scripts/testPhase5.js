const connectDatabase = require("../config/database");
const app = require("../app");
const mongoose = require("mongoose");
const http = require("http");
const cacheService = require("../services/cacheService");
const Student = require("../models/Student");
const Program = require("../models/Program");
const Application = require("../models/Application");

async function runTests() {
  console.log("=== PHASE 5 PERFORMANCE & CACHING VERIFICATION SUITE ===");

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
    console.log("--- 1. Testing Discovery Cache (Universities & Programs) ---");
    await cacheService.clear();

    const uniReq1 = await fetch(`${baseUrl}/universities?limit=3`);
    const uniRes1 = await uniReq1.json();
    assert(uniRes1.meta?.cache === "miss", "Universities 1st call is cache: miss");

    const uniReq2 = await fetch(`${baseUrl}/universities?limit=3`);
    const uniRes2 = await uniReq2.json();
    assert(uniRes2.meta?.cache === "hit", "Universities 2nd call is cache: hit");
    assert(uniRes2.data.length === 3, "Cached payload integrity preserved");

    const progReq1 = await fetch(`${baseUrl}/programs?country=UK&limit=3`);
    const progRes1 = await progReq1.json();
    assert(progRes1.meta?.cache === "miss", "Programs 1st call is cache: miss");

    const progReq2 = await fetch(`${baseUrl}/programs?country=UK&limit=3`);
    const progRes2 = await progReq2.json();
    assert(progRes2.meta?.cache === "hit", "Programs 2nd call is cache: hit");

    console.log("\n--- 2. Testing Recommendations Caching & Write Invalidation ---");
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "aarav@example.com", password: "Candidate123!" }),
    });
    const loginData = await loginRes.json();
    const token = loginData.data.token;
    const studentId = loginData.data.user._id;

    const rec1Res = await fetch(`${baseUrl}/recommendations/${studentId}`);
    const rec1Data = await rec1Res.json();
    assert(rec1Data.meta?.cache === "miss", "Recommendations 1st call is cache: miss");

    const rec2Res = await fetch(`${baseUrl}/recommendations/${studentId}`);
    const rec2Data = await rec2Res.json();
    assert(rec2Data.meta?.cache === "hit", "Recommendations 2nd call is cache: hit");

    console.log("Executing profile write to trigger cache invalidation...");
    const updateRes = await fetch(`${baseUrl}/auth/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        budget: 28000,
        preferredCountries: ["Ireland", "Germany"],
      }),
    });
    assert(updateRes.status === 200, "Profile write HTTP 200 OK");

    const rec3Res = await fetch(`${baseUrl}/recommendations/${studentId}`);
    const rec3Data = await rec3Res.json();
    assert(rec3Data.meta?.cache === "miss", "Cache successfully invalidated on profile write (cache: miss)");
    assert(rec3Data.data.student.budget === 28000, "Fresh recommendations reflect updated budget 28000");

    await fetch(`${baseUrl}/auth/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        budget: 23000,
        preferredCountries: ["UAE", "UK", "Canada"],
      }),
    });

    console.log("\n--- 3. Testing Application Write Invalidation on Dashboard Cache ---");
    await cacheService.set("dashboard:overview", { stats: "cached" }, 300);
    const cachedBefore = await cacheService.get("dashboard:overview");
    assert(cachedBefore !== null, "Dashboard overview cache primed");

    const testProgram = await Program.findOne({ intakes: { $in: ["September"] } });
    await Application.deleteMany({
      student: studentId,
      program: testProgram._id,
      intake: "Phase5CacheTestIntake",
    });

    const createRes = await fetch(`${baseUrl}/applications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        programId: testProgram._id,
        intake: "Phase5CacheTestIntake",
      }),
    });
    const createData = await createRes.json();
    assert(createRes.status === 201, "Application creation HTTP 201 Created");

    const cachedAfter = await cacheService.get("dashboard:overview");
    assert(cachedAfter === null, "Dashboard cache invalidated after application creation");

    await Application.findByIdAndDelete(createData.data._id);

    console.log("\n--- 4. Testing Memory Cache Fallback & TTL Expiration ---");
    const testKey = "test:ttl:key";
    await cacheService.set(testKey, { sample: 123 }, 1);
    const immediateVal = await cacheService.get(testKey);
    assert(immediateVal !== null && immediateVal.sample === 123, "Cache set and retrieved within TTL");

    console.log("Waiting 1.2s for TTL expiration...");
    await new Promise((r) => setTimeout(r, 1200));

    const expiredVal = await cacheService.get(testKey);
    assert(expiredVal === null, "Cache key expired cleanly after TTL");

    console.log("\n--- 5. Verifying lean() & Projection Payloads ---");
    const sampleProg = await Program.findOne()
      .select("title tuitionFeeUsd country")
      .lean();

    assert(Boolean(sampleProg.title), "lean() object contains projected field 'title'");
    assert(Boolean(sampleProg.tuitionFeeUsd), "lean() object contains projected field 'tuitionFeeUsd'");
    assert(sampleProg.durationMonths === undefined, "Unprojected field 'durationMonths' omitted from payload");
    assert(sampleProg.save === undefined, "lean() returns plain Javascript Object (no Mongoose document methods)");

    console.log(`\n========================================`);
    console.log(`TOTAL PHASE 5 TESTS: ${passed + failed}`);
    console.log(`PASSED: ${passed}`);
    console.log(`FAILED: ${failed}`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Phase 5 test execution error:", error);
    process.exit(1);
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runTests();
