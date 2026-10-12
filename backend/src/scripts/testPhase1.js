const connectDatabase = require("../config/database");
const app = require("../app");
const mongoose = require("mongoose");
const http = require("http");

async function runTests() {
  console.log("=== PHASE 1 AUTOMATED VERIFICATION SUITE ===");

  await connectDatabase();

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/auth`;

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
    console.log("--- 1. Testing Seeded Accounts Login ---");
    const aaravLoginRes = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "aarav@example.com", password: "Candidate123!" }),
    });
    const aaravLogin = await aaravLoginRes.json();
    assert(aaravLoginRes.status === 200, "Aarav login HTTP 200");
    assert(aaravLogin.success === true, "Aarav login success === true");
    assert(Boolean(aaravLogin.data?.token), "Aarav login returned JWT token");
    assert(!aaravLogin.data?.user?.password, "Aarav login NEVER returns password hash");
    assert(Array.isArray(aaravLogin.data?.user?.preferredCountries), "Aarav has preferredCountries array");
    assert(aaravLogin.data?.user?.budget === 23000, "Aarav has budget = 23000");
    assert(aaravLogin.data?.user?.ieltsScore === 7, "Aarav has ieltsScore = 7");

    console.log("\n--- 2. Testing Login Edge Cases ---");
    const badPassRes = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "aarav@example.com", password: "WrongPassword!" }),
    });
    const badPass = await badPassRes.json();
    assert(badPassRes.status === 401, "Wrong password HTTP 401");
    assert(badPass.success === false, "Wrong password success === false");

    const badEmailRes = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nonexistent@example.com", password: "Candidate123!" }),
    });
    const badEmail = await badEmailRes.json();
    assert(badEmailRes.status === 401, "Nonexistent email HTTP 401");
    assert(badEmail.success === false, "Nonexistent email success === false");

    const emptyLoginRes = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "notanemail", password: "" }),
    });
    const emptyLogin = await emptyLoginRes.json();
    assert(emptyLoginRes.status === 400, "Validation on malformed login HTTP 400");
    assert(emptyLogin.success === false, "Validation failure success === false");
    assert(Boolean(emptyLogin.details), "Validation details provided");

    console.log("\n--- 3. Testing User Registration ---");
    const testEmail = `testuser_${Date.now()}@example.com`;
    const regPayload = {
      fullName: "Ananya Sharma",
      email: testEmail,
      password: "SecurePassword123!",
      role: "student",
      preferredCountries: ["Germany", "Ireland"],
      budget: 18000,
      fieldOfStudy: ["Artificial Intelligence"],
      intake: "September",
      ieltsScore: 7.5,
    };

    const regRes = await fetch(`${baseUrl}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(regPayload),
    });
    const regData = await regRes.json();
    assert(regRes.status === 201, "User registration HTTP 201");
    assert(regData.success === true, "User registration success === true");
    assert(Boolean(regData.data?.token), "Registration returned token");
    assert(!regData.data?.user?.password, "Registration NEVER returns password hash");
    assert(regData.data?.user?.fullName === "Ananya Sharma", "Registered user fullName matches");
    assert(regData.data?.user?.budget === 18000, "Registered user budget matches");
    assert(regData.data?.user?.ieltsScore === 7.5, "Registered user ieltsScore matches");

    const newStudentToken = regData.data.token;

    console.log("\n--- 4. Testing Duplicate Registration Prevention ---");
    const dupRes = await fetch(`${baseUrl}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(regPayload),
    });
    const dupData = await dupRes.json();
    assert(dupRes.status === 409, "Duplicate registration HTTP 409");
    assert(dupData.success === false, "Duplicate registration success === false");

    console.log("\n--- 5. Testing Registration Validation ---");
    const badRegRes = await fetch(`${baseUrl}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "A",
        email: "invalid-email",
        password: "short",
        budget: -500,
        ieltsScore: 12,
      }),
    });
    const badRegData = await badRegRes.json();
    assert(badRegRes.status === 400, "Invalid registration input HTTP 400");
    assert(badRegData.success === false, "Invalid registration success === false");
    assert(badRegData.details?.length >= 4, "Multiple validation errors caught");

    console.log("\n--- 6. Testing Protected GET Profile ---");
    const unauthRes = await fetch(`${baseUrl}/profile`);
    const unauthData = await unauthRes.json();
    assert(unauthRes.status === 401, "GET /profile without token HTTP 401");
    assert(unauthData.success === false, "Unauthenticated success === false");

    const badTokenRes = await fetch(`${baseUrl}/profile`, {
      headers: { Authorization: "Bearer bad.token.here" },
    });
    assert(badTokenRes.status === 401, "GET /profile with invalid token HTTP 401");

    const authProfileRes = await fetch(`${baseUrl}/profile`, {
      headers: { Authorization: `Bearer ${newStudentToken}` },
    });
    const authProfile = await authProfileRes.json();
    assert(authProfileRes.status === 200, "GET /profile with valid token HTTP 200");
    assert(authProfile.success === true, "GET /profile success === true");
    assert(authProfile.data?.email === testEmail, "Profile email matches");
    assert(authProfile.data?.budget === 18000, "Profile budget matches");
    assert(authProfile.data?.ieltsScore === 7.5, "Profile ieltsScore matches");
    assert(!authProfile.data?.password, "GET /profile NEVER returns password hash");

    const meRes = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${newStudentToken}` },
    });
    const meData = await meRes.json();
    assert(meRes.status === 200, "GET /me with valid token HTTP 200");
    assert(meData.data?.email === testEmail, "GET /me data matches");

    console.log("\n--- 7. Testing Protected PUT Profile ---");
    const updatePayload = {
      fullName: "Ananya Sharma-Verma",
      preferredCountries: ["Germany", "Switzerland", "Sweden"],
      budget: 25000,
      fieldOfStudy: ["Machine Learning", "Data Engineering"],
      intake: "Spring 2027",
      ieltsScore: 8.0,
    };

    const updateRes = await fetch(`${baseUrl}/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${newStudentToken}`,
      },
      body: JSON.stringify(updatePayload),
    });
    const updateData = await updateRes.json();
    assert(updateRes.status === 200, "PUT /profile HTTP 200");
    assert(updateData.success === true, "PUT /profile success === true");
    assert(updateData.data?.fullName === "Ananya Sharma-Verma", "Updated fullName verified");
    assert(updateData.data?.budget === 25000, "Updated budget verified");
    assert(updateData.data?.ieltsScore === 8.0, "Updated ieltsScore verified");
    assert(updateData.data?.intake === "Spring 2027", "Updated intake verified");
    assert(updateData.data?.preferredCountries?.length === 3, "Updated preferredCountries length === 3");
    assert(!updateData.data?.password, "PUT /profile NEVER returns password hash");

    console.log("\n--- 8. Testing PUT Profile Validation ---");
    const badUpdateRes = await fetch(`${baseUrl}/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${newStudentToken}`,
      },
      body: JSON.stringify({ ieltsScore: 15, budget: -10 }),
    });
    const badUpdateData = await badUpdateRes.json();
    assert(badUpdateRes.status === 400, "PUT /profile invalid data HTTP 400");
    assert(badUpdateData.success === false, "PUT /profile invalid data success === false");

    console.log("\n--- 9. Testing Role-Based Middleware ---");
    const studentRoleRes = await fetch(`${baseUrl}/counselor-test`, {
      headers: { Authorization: `Bearer ${newStudentToken}` },
    });
    const studentRoleData = await studentRoleRes.json();
    assert(studentRoleRes.status === 403, "Student accessing counselor endpoint HTTP 403 Forbidden");
    assert(studentRoleData.success === false, "Student access success === false");
    assert(studentRoleData.message.includes("Forbidden"), "Role rejection message includes 'Forbidden'");

    const counselorLoginRes = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "counselor@example.com", password: "Candidate123!" }),
    });
    const counselorLogin = await counselorLoginRes.json();
    const counselorToken = counselorLogin.data.token;

    const counselorRoleRes = await fetch(`${baseUrl}/counselor-test`, {
      headers: { Authorization: `Bearer ${counselorToken}` },
    });
    const counselorRoleData = await counselorRoleRes.json();
    assert(counselorRoleRes.status === 200, "Counselor accessing counselor endpoint HTTP 200 OK");
    assert(counselorRoleData.success === true, "Counselor access success === true");

    console.log(`\n========================================`);
    console.log(`TOTAL TESTS: ${passed + failed}`);
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
