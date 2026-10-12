const request = require("supertest");
const express = require("express");
const app = require("../src/app");
const { setupTestDB, teardownTestDB } = require("./setup");
const logger = require("../src/utils/logger");
const { createRateLimiter } = require("../src/middleware/rateLimiter");

describe("Phase 7: Security & Robustness Suite", () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  describe("1. Helmet Security Headers", () => {
    it("should set essential HTTP security headers on responses", async () => {
      const res = await request(app).get("/api/health");

      expect(res.status).toBe(200);
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
      expect(res.headers["x-dns-prefetch-control"]).toBe("off");
      expect(res.headers["x-download-options"]).toBe("noopen");
      expect(res.headers["x-permitted-cross-domain-policies"]).toBe("none");
      expect(res.headers["referrer-policy"]).toBe("no-referrer");
    });
  });

  describe("2. CORS Whitelist Policy", () => {
    it("should allow requests from whitelisted origins", async () => {
      const res = await request(app)
        .get("/api/health")
        .set("Origin", "http://localhost:3000");

      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    });

    it("should allow requests from Vite dev server whitelisted origin", async () => {
      const res = await request(app)
        .get("/api/health")
        .set("Origin", "http://localhost:5173");

      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    });

    it("should allow requests with no origin (mobile / curl / server-to-server)", async () => {
      const res = await request(app).get("/api/health");

      expect(res.status).toBe(200);
    });

    it("should reject requests from unauthorized origins with 403 Forbidden", async () => {
      const res = await request(app)
        .get("/api/health")
        .set("Origin", "http://malicious-site.example.com");

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/CORS/i);
    });
  });

  describe("3. Request Body Size Limits", () => {
    it("should allow requests within 100kb payload size limit", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "test@example.com",
          password: "NormalPassword123!",
        });

      expect(res.status).toBe(401);
    });

    it("should reject requests exceeding 100kb with 413 Payload Too Large", async () => {
      const oversizedPayload = {
        email: "test@example.com",
        password: "A".repeat(110 * 1024),
      };

      const res = await request(app)
        .post("/api/auth/login")
        .send(oversizedPayload);

      expect(res.status).toBe(413);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/size limit|too large/i);
    });
  });

  describe("4. NoSQL Injection Prevention (express-mongo-sanitize)", () => {
    it("should sanitize dangerous MongoDB query operators ($ and .) from request body", async () => {
      const testSanitizeApp = express();
      const mongoSanitize = require("express-mongo-sanitize");
      testSanitizeApp.use(express.json());
      testSanitizeApp.use(mongoSanitize());
      testSanitizeApp.post("/test-sanitize", (req, res) => {
        res.json({ body: req.body });
      });

      const res = await request(testSanitizeApp)
        .post("/test-sanitize")
        .send({
          email: "clean@example.com",
          $where: "sleep(5000)",
          query: {
            $gt: "",
            safeField: "safeValue",
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.body.email).toBe("clean@example.com");
      expect(res.body.body.$where).toBeUndefined();
      expect(res.body.body.query.$gt).toBeUndefined();
      expect(res.body.body.query.safeField).toBe("safeValue");
    });
  });

  describe("5. Rate Limiting (express-rate-limit)", () => {
    it("should enforce strict rate limits on auth routes and return 429", async () => {
      const testLimiterApp = express();
      const strictAuthLimiter = createRateLimiter({
        windowMs: 60 * 1000,
        max: 3,
        message: "Too many authentication attempts, please try again later.",
      });

      testLimiterApp.use(express.json());
      testLimiterApp.post("/auth/login", strictAuthLimiter, (req, res) => {
        res.json({ success: true, message: "Login attempt processed" });
      });

      for (let i = 0; i < 3; i++) {
        const res = await request(testLimiterApp).post("/auth/login").send({});
        expect(res.status).toBe(200);
      }

      const blockedRes = await request(testLimiterApp).post("/auth/login").send({});
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.success).toBe(false);
      expect(blockedRes.body.message).toBe("Too many authentication attempts, please try again later.");
      expect(blockedRes.headers["retry-after"]).toBeDefined();
    });

    it("should enforce global rate limits and return 429 when exceeded", async () => {
      const testLimiterApp = express();
      const globalLimiterTest = createRateLimiter({
        windowMs: 60 * 1000,
        max: 2,
        message: "Too many requests from this IP, please try again later.",
      });

      testLimiterApp.use("/api", globalLimiterTest);
      testLimiterApp.get("/api/data", (req, res) => {
        res.json({ success: true });
      });

      await request(testLimiterApp).get("/api/data").expect(200);
      await request(testLimiterApp).get("/api/data").expect(200);

      const blockedRes = await request(testLimiterApp).get("/api/data");
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.success).toBe(false);
      expect(blockedRes.body.message).toBe("Too many requests from this IP, please try again later.");
    });
  });

  describe("6. Structured Logging", () => {
    it("should format application log events as valid JSON with timestamp, level, and message", () => {
      const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});

      const prevEnv = process.env.NODE_ENV;
      const prevTestLogs = process.env.ENABLE_TEST_LOGS;
      try {
        process.env.ENABLE_TEST_LOGS = "true";

        logger.info("Application service started", { port: 4000, env: "test" });

        expect(consoleLogSpy).toHaveBeenCalledTimes(1);
        const loggedString = consoleLogSpy.mock.calls[0][0];
        const parsedLog = JSON.parse(loggedString);

        expect(parsedLog.level).toBe("info");
        expect(parsedLog.message).toBe("Application service started");
        expect(parsedLog.port).toBe(4000);
        expect(parsedLog.env).toBe("test");
        expect(parsedLog.timestamp).toBeDefined();
        expect(new Date(parsedLog.timestamp).toISOString()).toBe(parsedLog.timestamp);
      } finally {
        process.env.NODE_ENV = prevEnv;
        process.env.ENABLE_TEST_LOGS = prevTestLogs;
        consoleLogSpy.mockRestore();
      }
    });
  });
});
