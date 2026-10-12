const http = require("http");
const express = require("express");
const connectDatabase = require("../config/database");
const app = require("../app");
const logger = require("../utils/logger");
const { createRateLimiter } = require("../middleware/rateLimiter");

async function runTests() {
  console.log("=== PHASE 7 SECURITY & ROBUSTNESS VERIFICATION SUITE ===");

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
    console.log("--- 1. Testing Helmet HTTP Security Headers ---");
    const healthRes = await fetch(`${baseUrl}/health`);
    assert(healthRes.status === 200, "Health check endpoint reachable HTTP 200");
    assert(
      healthRes.headers.get("x-content-type-options") === "nosniff",
      "Helmet sets X-Content-Type-Options: nosniff"
    );
    assert(
      healthRes.headers.get("x-frame-options") === "SAMEORIGIN",
      "Helmet sets X-Frame-Options: SAMEORIGIN"
    );
    assert(
      healthRes.headers.get("x-dns-prefetch-control") === "off",
      "Helmet sets X-DNS-Prefetch-Control: off"
    );
    assert(
      healthRes.headers.get("x-download-options") === "noopen",
      "Helmet sets X-Download-Options: noopen"
    );
    assert(
      healthRes.headers.get("x-permitted-cross-domain-policies") === "none",
      "Helmet sets X-Permitted-Cross-Domain-Policies: none"
    );
    assert(
      healthRes.headers.get("referrer-policy") === "no-referrer",
      "Helmet sets Referrer-Policy: no-referrer"
    );

    console.log("\n--- 2. Testing CORS Whitelist Policy ---");
    const allowedCorsRes = await fetch(`${baseUrl}/health`, {
      headers: { Origin: "http://localhost:3000" },
    });
    assert(
      allowedCorsRes.status === 200,
      "Allowed origin (localhost:3000) succeeds HTTP 200"
    );
    assert(
      allowedCorsRes.headers.get("access-control-allow-origin") === "http://localhost:3000",
      "Access-Control-Allow-Origin header set for whitelisted origin"
    );

    const viteCorsRes = await fetch(`${baseUrl}/health`, {
      headers: { Origin: "http://localhost:5173" },
    });
    assert(
      viteCorsRes.headers.get("access-control-allow-origin") === "http://localhost:5173",
      "Access-Control-Allow-Origin header set for Vite dev origin (5173)"
    );

    const disallowedCorsRes = await fetch(`${baseUrl}/health`, {
      headers: { Origin: "http://malicious-website.com" },
    });
    assert(
      disallowedCorsRes.status === 403,
      "Disallowed origin blocked with HTTP 403 Forbidden"
    );
    const corsErrorData = await disallowedCorsRes.json();
    assert(
      corsErrorData.success === false && /CORS/i.test(corsErrorData.message),
      "Error response indicates CORS policy rejection"
    );

    console.log("\n--- 3. Testing Request Body Size Limits ---");
    const normalPayloadRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "aarav@example.com", password: "Candidate123!" }),
    });
    assert(
      normalPayloadRes.status === 200,
      "Normal payload under 100kb accepted HTTP 200"
    );

    const oversizedPayload = {
      email: "test@example.com",
      password: "X".repeat(110 * 1024),
    };
    const oversizedRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(oversizedPayload),
    });
    assert(
      oversizedRes.status === 413,
      "Oversized payload (>100kb) rejected with HTTP 413 Payload Too Large"
    );
    const oversizedData = await oversizedRes.json();
    assert(
      oversizedData.success === false && /size limit|too large/i.test(oversizedData.message),
      "Error response indicates payload size limit exceeded"
    );

    console.log("\n--- 4. Testing express-mongo-sanitize (NoSQL Injection Defense) ---");
    const mongoSanitize = require("express-mongo-sanitize");
    const sanitizeTestApp = express();
    sanitizeTestApp.use(express.json());
    sanitizeTestApp.use(mongoSanitize());
    sanitizeTestApp.post("/test-sanitize", (req, res) => res.json({ body: req.body }));

    const sanitizeServer = http.createServer(sanitizeTestApp);
    await new Promise((resolve) => sanitizeServer.listen(0, resolve));
    const sanitizePort = sanitizeServer.address().port;

    const sanitizeRes = await fetch(`http://127.0.0.1:${sanitizePort}/test-sanitize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "student@example.com",
        $where: "sleep(5000)",
        query: { $gt: "" },
      }),
    });
    const sanitizeData = await sanitizeRes.json();
    assert(sanitizeData.body.email === "student@example.com", "Safe fields preserved");
    assert(sanitizeData.body.$where === undefined, "Dangerous $where key stripped");
    assert(sanitizeData.body.query.$gt === undefined, "Dangerous nested $gt operator stripped");
    await new Promise((resolve) => sanitizeServer.close(resolve));

    console.log("\n--- 5. Testing Rate Limiting (express-rate-limit) ---");
    const rateLimitTestApp = express();
    const testAuthLimiter = createRateLimiter({
      windowMs: 60 * 1000,
      max: 3,
      message: "Too many authentication attempts, please try again later.",
    });
    rateLimitTestApp.post("/auth/login", testAuthLimiter, (req, res) => {
      res.json({ success: true });
    });
    const rateLimitServer = http.createServer(rateLimitTestApp);
    await new Promise((resolve) => rateLimitServer.listen(0, resolve));
    const rateLimitPort = rateLimitServer.address().port;

    for (let i = 0; i < 3; i++) {
      const res = await fetch(`http://127.0.0.1:${rateLimitPort}/auth/login`, { method: "POST" });
      assert(res.status === 200, `Rate limiter allows request ${i + 1} under limit (HTTP 200)`);
    }

    const rateLimitBlockedRes = await fetch(`http://127.0.0.1:${rateLimitPort}/auth/login`, {
      method: "POST",
    });
    assert(
      rateLimitBlockedRes.status === 429,
      "Rate limiter blocks request 4 with HTTP 429 Too Many Requests"
    );
    const rateLimitBlockedData = await rateLimitBlockedRes.json();
    assert(
      rateLimitBlockedData.success === false &&
        rateLimitBlockedData.message === "Too many authentication attempts, please try again later.",
      "429 response body returns standardized JSON structure and message"
    );
    await new Promise((resolve) => rateLimitServer.close(resolve));

    console.log("\n--- 6. Testing Structured JSON Logging ---");
    let loggedOutput = "";
    const originalLog = console.log;
    console.log = (msg) => {
      loggedOutput = msg;
    };
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      logger.info("Service health status check", { component: "healthCheck", status: "up" });
      const parsedLog = JSON.parse(loggedOutput);
      assert(parsedLog.level === "info", "Structured log contains valid level");
      assert(parsedLog.message === "Service health status check", "Structured log contains message");
      assert(parsedLog.component === "healthCheck", "Structured log preserves metadata");
      assert(Boolean(parsedLog.timestamp), "Structured log contains ISO timestamp");
    } finally {
      process.env.NODE_ENV = prevEnv;
      console.log = originalLog;
    }

  } catch (err) {
    console.error("Test execution failed:", err);
    failed++;
  } finally {
    await new Promise((resolve) => server.close(resolve));
    const mongoose = require("mongoose");
    await mongoose.disconnect();
  }

  console.log("\n========================================");
  console.log(`TOTAL PHASE 7 TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log("========================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
