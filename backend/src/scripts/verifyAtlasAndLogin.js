const http = require("http");
const connectDatabase = require("../config/database");
const app = require("../app");
const env = require("../config/env");
const { seedDatabase } = require("./seed");

async function verify() {
  console.log("=== VERIFYING ATLAS CONNECTION, HEALTH, AND LOGIN ===");

  console.log("1. Connecting to database...");
  await connectDatabase();

  console.log("2. Running idempotent auto-seed on Atlas...");
  if (env.autoSeed) {
    const seedResult = await seedDatabase({ force: false });
    console.log("Auto-seed status:", seedResult.seeded ? "Seeded initial data" : "Already populated (idempotent skip)");
  }

  console.log("3. Starting HTTP server...");
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;
  console.log(`Server listening on ephemeral test port ${port}`);

  let allPassed = true;

  try {
    console.log("\n--- Checking GET /api/health ---");
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthData = await healthRes.json();
    console.log("Health HTTP Status:", healthRes.status);
    console.log("Health Response:", JSON.stringify(healthData));

    if (healthRes.status === 200 && healthData.success === true) {
      console.log("[PASS] /api/health returned 200 OK with success: true");
    } else {
      console.error("[FAIL] /api/health failed");
      allPassed = false;
    }

    console.log("\n--- Checking POST /api/auth/login with aarav@example.com ---");
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "aarav@example.com",
        password: "Candidate123!",
      }),
    });
    const loginData = await loginRes.json();
    console.log("Login HTTP Status:", loginRes.status);
    console.log("Login Message:", loginData.message);
    console.log("Token Received:", loginData.data?.token ? "YES (JWT present)" : "NO");
    console.log("User Email:", loginData.data?.user?.email);
    console.log("User Name:", loginData.data?.user?.fullName);
    console.log("User Role:", loginData.data?.user?.role);
    console.log("Password Hash Leaked:", loginData.data?.user?.password ? "YES (LEAK!)" : "NO (SAFE)");

    if (
      loginRes.status === 200 &&
      loginData.success === true &&
      loginData.data?.token &&
      loginData.data?.user?.email === "aarav@example.com" &&
      !loginData.data?.user?.password
    ) {
      console.log("[PASS] Login succeeded with token and secure user profile!");
    } else {
      console.error("[FAIL] Login failed or returned unexpected payload");
      allPassed = false;
    }

    console.log("\n--- Verifying Protected Profile (GET /api/auth/profile) ---");
    const profileRes = await fetch(`${baseUrl}/auth/profile`, {
      headers: { Authorization: `Bearer ${loginData.data.token}` },
    });
    const profileData = await profileRes.json();
    const student = profileData.data?.student || profileData.data?.user || profileData.data;
    console.log("Profile HTTP Status:", profileRes.status);
    console.log("Profile Student Name:", student?.fullName);
    console.log("Profile Budget:", student?.budget);
    console.log("Profile Preferred Countries:", JSON.stringify(student?.preferredCountries));

    if (profileRes.status === 200 && student?.email === "aarav@example.com") {
      console.log("[PASS] Authenticated profile fetch verified against Atlas!");
    } else {
      console.error("[FAIL] Profile fetch failed");
      allPassed = false;
    }

  } catch (err) {
    console.error("Verification encountered error:", err);
    allPassed = false;
  } finally {
    await new Promise((resolve) => server.close(resolve));
    const mongoose = require("mongoose");
    await mongoose.disconnect();
  }

  console.log("\n========================================");
  console.log("FINAL STATUS:", allPassed ? "ALL CHECKS PASSED SUCCESSFULLY" : "ONE OR MORE CHECKS FAILED");
  console.log("========================================");

  if (!allPassed) {
    process.exit(1);
  }
}

verify();
