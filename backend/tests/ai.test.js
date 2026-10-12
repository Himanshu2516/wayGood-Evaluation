const request = require("supertest");
const app = require("../src/app");
const { setupTestDB, teardownTestDB, seedTestDB } = require("./setup");
const env = require("../src/config/env");
const cacheService = require("../src/services/cacheService");
const Student = require("../src/models/Student");
const { createRateLimiter } = require("../src/middleware/rateLimiter");
const express = require("express");

describe("AI Study Planning and Recommendations (Groq API)", () => {
  let studentToken;
  let counselorToken;
  let studentAarav;
  let originalGroqKey;
  let originalFetch;

  beforeAll(async () => {
    await setupTestDB();
    await seedTestDB();

    originalGroqKey = env.groqApiKey;
    originalFetch = global.fetch;

    const studentRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "aarav@example.com", password: "Candidate123!" });
    studentToken = studentRes.body.data.token;
    studentAarav = studentRes.body.data.user;

    const counselorRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "counselor@example.com", password: "Candidate123!" });
    counselorToken = counselorRes.body.data.token;
  });

  afterAll(async () => {
    env.groqApiKey = originalGroqKey;
    global.fetch = originalFetch;
    await teardownTestDB();
  });

  beforeEach(async () => {
    await cacheService.clear();
    env.groqApiKey = "gsk_test_mock_groq_key_12345";
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("1. Authentication & Role Protection", () => {
    it("should return 401 when request has no token", async () => {
      const res = await request(app).post("/api/ai/study-plan").send({});
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/token/i);
    });

    it("should return 403 when authenticated as a non-student role (counselor)", async () => {
      const res = await request(app)
        .post("/api/ai/study-plan")
        .set("Authorization", `Bearer ${counselorToken}`)
        .send({});
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Forbidden/i);
    });
  });

  describe("2. Incomplete Profile Validation (400)", () => {
    it("should return 400 and tell the student which profile fields are missing", async () => {
      const incompleteStudent = await Student.create({
        fullName: "Incomplete Candidate",
        email: "incomplete@example.com",
        password: "Password123!",
        role: "student",
        preferredCountries: [],
        budget: 0,
        fieldOfStudy: [],
        intake: "",
        ieltsScore: 0,
      });

      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: "incomplete@example.com", password: "Password123!" });
      const incompleteToken = loginRes.body.data.token;

      const res = await request(app)
        .post("/api/ai/study-plan")
        .set("Authorization", `Bearer ${incompleteToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Incomplete profile/i);
      expect(res.body.message).toMatch(/preferredCountries/);
      expect(res.body.message).toMatch(/budget/);
      expect(res.body.message).toMatch(/fieldOfStudy/);
      expect(res.body.message).toMatch(/intake/);
      expect(res.body.message).toMatch(/ieltsScore/);
    });
  });

  describe("3. Groq API Primary Model Execution (POST /api/ai/study-plan)", () => {
    it("should parse valid Groq response and return structured study plan with meta.source 'groq'", async () => {
      const mockGroqStudyPlan = {
        summary: "Tailored application roadmap for Computer Science targeting Fall 2025 intake.",
        shortlist: [
          {
            programTitle: "Master of Applied Computing",
            university: "University of Windsor",
            reason: "Top academic alignment with high match score.",
            risk: "High tuition fee requires early scholarship application.",
            tuitionFeeUsd: 22800,
            ieltsGap: 0.5,
          },
          {
            programTitle: "Master of Engineering Management",
            university: "University of Windsor",
            reason: "Strong curriculum and affordable tuition within budget.",
            risk: "verify with the university for exact internship prerequisites.",
            tuitionFeeUsd: 21400,
            ieltsGap: 0.5,
          },
          {
            programTitle: "BSc Computer Science",
            university: "Heriot-Watt University Dubai",
            reason: "Excellent research labs and faculty expertise.",
            risk: "Competitive applicant pool.",
            tuitionFeeUsd: 16200,
            ieltsGap: 1.0,
          },
        ],
        timeline: [
          { month: "Month 1 - 2", task: "Prepare academic transcripts and finalize program choices." },
          { month: "Month 3 - 4", task: "Complete Statement of Purpose and request recommendation letters." },
          { month: "Month 5", task: "Submit applications before international deadlines." },
          { month: "Month 6 - 8", task: "Accept admissions offer and file student visa." },
        ],
        documentsChecklist: [
          "Official Academic Transcripts",
          "Statement of Purpose (SOP)",
          "2 Letters of Recommendation (LOR)",
          "IELTS Test Score Report",
          "Financial Bank Solvency Proof",
        ],
        budgetNotes: "Annual budget covers program tuition comfortably.",
        nextSteps: [
          "Confirm program shortlist",
          "Begin statement of purpose draft",
          "Request academic transcripts",
        ],
      };

      global.fetch = jest.fn().mockImplementation(async (url, options) => {
        const body = JSON.parse(options.body);
        expect(body.model).toBe("openai/gpt-oss-120b");
        expect(body.temperature).toBe(0.2);
        expect(body.response_format).toEqual({ type: "json_object" });
        expect(body.reasoning_effort).toBe("low");
        expect(body.max_completion_tokens).toBe(1500);

        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify(mockGroqStudyPlan),
                },
              },
            ],
          }),
        };
      });

      const res = await request(app)
        .post("/api/ai/study-plan")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.source).toBe("groq");
      expect(res.body.meta.model).toBe("openai/gpt-oss-120b");

      const { studyPlan } = res.body.data;
      expect(studyPlan.summary).toBe(mockGroqStudyPlan.summary);
      expect(studyPlan.shortlist.length).toBe(3);
      expect(studyPlan.shortlist[0].programTitle).toBe("Master of Applied Computing");
      expect(studyPlan.shortlist[0].ieltsGap).toBe(0.5);
      expect(studyPlan.timeline.length).toBe(4);
      expect(Array.isArray(studyPlan.documentsChecklist)).toBe(true);
      expect(typeof studyPlan.budgetNotes).toBe("string");
      expect(Array.isArray(studyPlan.nextSteps)).toBe(true);
    });
  });

  describe("4. Grounding & Program Validation: Unknown Programs Rejected", () => {
    it("should reject Groq output referencing an invented program not in the supplied list and fall back", async () => {
      const mockInventedPlan = {
        summary: "Plan with hallucinated program.",
        shortlist: [
          {
            programTitle: "Totally Nonexistent Fake Degree XYZ",
            university: "Imaginary University",
            reason: "Hallucination.",
            risk: "None.",
            tuitionFeeUsd: 10000,
            ieltsGap: 0,
          },
          {
            programTitle: "Master of Science in Computer Science",
            university: "University of Oxford",
            reason: "Valid.",
            risk: "None.",
            tuitionFeeUsd: 28000,
            ieltsGap: 0.5,
          },
          {
            programTitle: "Master of Data Science",
            university: "University of Melbourne",
            reason: "Valid.",
            risk: "None.",
            tuitionFeeUsd: 22000,
            ieltsGap: 1.0,
          },
        ],
        timeline: [{ month: "Month 1", task: "Prep" }],
        documentsChecklist: ["Passport"],
        budgetNotes: "Notes",
        nextSteps: ["Step 1"],
      };

      global.fetch = jest.fn().mockImplementation(async () => {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({
            choices: [{ message: { content: JSON.stringify(mockInventedPlan) } }],
          }),
        };
      });

      const res = await request(app)
        .post("/api/ai/study-plan")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.meta.source).toBe("fallback");
      expect(res.body.meta.model).toBeNull();
      expect(res.body.data.studyPlan.shortlist.length).toBeGreaterThanOrEqual(1);
      const titles = res.body.data.studyPlan.shortlist.map((p) => p.programTitle);
      expect(titles).not.toContain("Totally Nonexistent Fake Degree XYZ");
    });
  });

  describe("5. Malformed JSON Handling", () => {
    it("should gracefully fall back when Groq returns invalid JSON", async () => {
      global.fetch = jest.fn().mockImplementation(async () => {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({
            choices: [{ message: { content: "{ invalid json string here..." } }],
          }),
        };
      });

      const res = await request(app)
        .post("/api/ai/study-plan")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.meta.source).toBe("fallback");
      expect(res.body.meta.model).toBeNull();
      expect(res.body.data.studyPlan).toBeDefined();
    });
  });

  describe("6. Missing GROQ_API_KEY Fallback", () => {
    it("should return rule-based fallback with meta.source 'fallback' when GROQ_API_KEY is not configured", async () => {
      env.groqApiKey = "";

      const res = await request(app)
        .post("/api/ai/study-plan")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.meta.source).toBe("fallback");
      expect(res.body.meta.model).toBeNull();
      expect(res.body.data.studyPlan.shortlist.length).toBeGreaterThan(0);
      expect(res.body.data.studyPlan.timeline.length).toBeGreaterThan(0);
      expect(res.body.data.studyPlan.documentsChecklist.length).toBeGreaterThan(0);
      expect(typeof res.body.data.studyPlan.budgetNotes).toBe("string");
    });
  });

  describe("7. Rate Limit 429 & Backup Model (llama-3.3-70b-versatile)", () => {
    it("should switch to backup model after primary model returns 429 and return meta.source 'groq-backup'", async () => {
      const mockBackupStudyPlan = {
        summary: "Backup model generated study plan.",
        shortlist: [
          {
            programTitle: "Master of Applied Computing",
            university: "University of Windsor",
            reason: "Academic fit.",
            risk: "Competitive entry.",
            tuitionFeeUsd: 22800,
            ieltsGap: 0.5,
          },
          {
            programTitle: "Master of Engineering Management",
            university: "University of Windsor",
            reason: "Tuition fits budget.",
            risk: "verify with the university for exact deadlines.",
            tuitionFeeUsd: 21400,
            ieltsGap: 0.5,
          },
          {
            programTitle: "BSc Computer Science",
            university: "Heriot-Watt University Dubai",
            reason: "Strong research prestige.",
            risk: "verify with the university.",
            tuitionFeeUsd: 16200,
            ieltsGap: 1.0,
          },
        ],
        timeline: [{ month: "Month 1", task: "Initial Preparation" }],
        documentsChecklist: ["Academic Transcripts", "Passport"],
        budgetNotes: "Tuition is within budget bounds.",
        nextSteps: ["Confirm with counselor"],
      };

      let callCount = 0;
      global.fetch = jest.fn().mockImplementation(async (url, options) => {
        callCount++;
        const body = JSON.parse(options.body);

        if (body.model === "openai/gpt-oss-120b") {
          return {
            ok: false,
            status: 429,
            headers: new Headers({ "retry-after": "0" }),
            text: async () => "Rate limit exceeded",
          };
        }

        if (body.model === "llama-3.3-70b-versatile") {
          expect(body.max_tokens).toBe(1500);
          return {
            ok: true,
            status: 200,
            headers: new Headers({ "content-type": "application/json" }),
            json: async () => ({
              choices: [{ message: { content: JSON.stringify(mockBackupStudyPlan) } }],
            }),
          };
        }

        return { ok: false, status: 500 };
      });

      const res = await request(app)
        .post("/api/ai/study-plan")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.meta.source).toBe("groq-backup");
      expect(res.body.meta.model).toBe("llama-3.3-70b-versatile");
      expect(res.body.data.studyPlan.shortlist.length).toBe(3);
    });
  });

  describe("8. Recommendation Insights Endpoint (POST /api/ai/recommendation-insights)", () => {
    it("should return recommendation insights with meta.source 'groq' when Groq succeeds", async () => {
      const mockInsights = {
        insights: [
          {
            programTitle: "Master of Applied Computing",
            whyItFits: "Directly matches your computer science background and preferred destination.",
            watchOut: "Tuition slightly stretches your budget cap.",
          },
          {
            programTitle: "BSc Computer Science",
            whyItFits: "Within tuition budget with excellent curriculum.",
            watchOut: "Ensure IELTS minimum score requirement is submitted.",
          },
        ],
        overallAdvice: "Target Windsor as reach and Melbourne as solid target.",
      };

      global.fetch = jest.fn().mockImplementation(async (url, options) => {
        const body = JSON.parse(options.body);
        expect(body.model).toBe("openai/gpt-oss-120b");
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({
            choices: [{ message: { content: JSON.stringify(mockInsights) } }],
          }),
        };
      });

      const res = await request(app)
        .post("/api/ai/recommendation-insights")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.meta.source).toBe("groq");
      expect(res.body.meta.model).toBe("openai/gpt-oss-120b");
      expect(Array.isArray(res.body.data.insights)).toBe(true);
      expect(res.body.data.insights[0].programTitle).toBe("Master of Applied Computing");
      expect(res.body.data.overallAdvice).toBe(mockInsights.overallAdvice);
    });

    it("should fall back gracefully to rule-based insights when GROQ_API_KEY is missing", async () => {
      env.groqApiKey = "";

      const res = await request(app)
        .post("/api/ai/recommendation-insights")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.meta.source).toBe("fallback");
      expect(res.body.meta.model).toBeNull();
      expect(Array.isArray(res.body.data.insights)).toBe(true);
      expect(res.body.data.insights.length).toBeGreaterThan(0);
      expect(typeof res.body.data.overallAdvice).toBe("string");
    });
  });

  describe("9. Caching & Profile Invalidation", () => {
    it("should serve study plan from cache on second call and invalidate when student profile is updated", async () => {
      env.groqApiKey = "";

      const res1 = await request(app)
        .post("/api/ai/study-plan")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({});
      expect(res1.status).toBe(200);

      const res2 = await request(app)
        .post("/api/ai/study-plan")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({});
      expect(res2.status).toBe(200);
      expect(res2.body.data.studyPlan.summary).toBe(res1.body.data.studyPlan.summary);

      const updateRes = await request(app)
        .put("/api/auth/profile")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ budget: 45000, intake: "Spring 2026" });
      expect(updateRes.status).toBe(200);

      const res3 = await request(app)
        .post("/api/ai/study-plan")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({});
      expect(res3.status).toBe(200);
      expect(res3.body.data.studyPlan.budgetNotes).toMatch(/45,000/);
    });
  });

  describe("10. AI Rate Limiting (express-rate-limit)", () => {
    it("should enforce rate limiting and return 429 when threshold exceeded", async () => {
      const testLimiterApp = express();
      const testAiLimiter = createRateLimiter({
        windowMs: 60 * 1000,
        max: 2,
        message: "Too many AI study plan generation requests, please try again later.",
      });

      testLimiterApp.use(express.json());
      testLimiterApp.post("/api/ai/study-plan", testAiLimiter, (req, res) => {
        res.json({ success: true, message: "Plan generated" });
      });

      await request(testLimiterApp).post("/api/ai/study-plan").send({}).expect(200);
      await request(testLimiterApp).post("/api/ai/study-plan").send({}).expect(200);

      const blockedRes = await request(testLimiterApp).post("/api/ai/study-plan").send({});
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.success).toBe(false);
      expect(blockedRes.body.message).toMatch(/Too many AI study plan generation requests/i);
    });
  });
});
