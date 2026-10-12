const request = require("supertest");
const app = require("../src/app");
const { setupTestDB, teardownTestDB, seedTestDB } = require("./setup");
const Student = require("../src/models/Student");
const mongoose = require("mongoose");

describe("Recommendation Engine (GET /api/recommendations)", () => {
  let aaravUser;
  let aaravToken;

  beforeAll(async () => {
    await setupTestDB();
    await seedTestDB();

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "aarav@example.com", password: "Candidate123!" });
    aaravToken = loginRes.body.data.token;
    aaravUser = loginRes.body.data.user;
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  it("should generate recommendations with weighted score and matchReasons using MongoDB aggregation", async () => {
    const res = await request(app).get(`/api/recommendations/${aaravUser._id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.meta.engine).toBe("mongodb-aggregation");
    expect(res.body.meta.maxPossibleScore).toBe(100);
    expect(Array.isArray(res.body.data.recommendations)).toBe(true);
    expect(res.body.data.recommendations.length).toBeGreaterThan(0);

    const topRec = res.body.data.recommendations[0];
    expect(typeof topRec.score).toBe("number");
    expect(topRec.score).toBeGreaterThan(0);
    expect(Array.isArray(topRec.matchReasons)).toBe(true);
    expect(topRec.matchReasons.length).toBeGreaterThan(0);
    expect(topRec.university).toBeDefined();
    expect(topRec.university.name).toBeDefined();
    expect(topRec.university.qsRanking).toBeDefined();

    for (let i = 1; i < res.body.data.recommendations.length; i++) {
      expect(res.body.data.recommendations[i].score).toBeLessThanOrEqual(
        res.body.data.recommendations[i - 1].score
      );
    }
  });

  it("should respect the limit query parameter", async () => {
    const res = await request(app).get(`/api/recommendations/${aaravUser._id}?limit=2`);

    expect(res.status).toBe(200);
    expect(res.body.data.recommendations.length).toBe(2);
  });

  it("should infer student identity from Bearer token when called without route param", async () => {
    const res = await request(app)
      .get("/api/recommendations")
      .set("Authorization", `Bearer ${aaravToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.student.id).toBe(aaravUser._id);
    expect(res.body.data.recommendations.length).toBeGreaterThan(0);
  });

  it("should handle students with missing/blank profile preferences gracefully", async () => {
    const blankStudent = await Student.create({
      fullName: "Empty Preferences Candidate",
      email: "empty_prefs@example.com",
      password: "SecurePassword123!",
      role: "student",
      preferredCountries: [],
      budget: 0,
      fieldOfStudy: [],
      intake: "",
      ieltsScore: 0,
    });

    const res = await request(app).get(`/api/recommendations/${blankStudent._id}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.recommendations)).toBe(true);
    expect(res.body.data.recommendations.length).toBeGreaterThan(0);

    const topRec = res.body.data.recommendations[0];
    expect(topRec.matchReasons).toContain("Popular program worldwide");

    await Student.findByIdAndDelete(blankStudent._id);
  });

  it("should return 400 for invalid student ID format and 404 for non-existent student ID", async () => {
    const invalidRes = await request(app).get("/api/recommendations/invalid-id-format");
    expect(invalidRes.status).toBe(400);

    const nonExistentId = new mongoose.Types.ObjectId().toString();
    const notFoundRes = await request(app).get(`/api/recommendations/${nonExistentId}`);
    expect(notFoundRes.status).toBe(404);
  });

  it("should return 400 when called without token and without studentId param", async () => {
    const res = await request(app).get("/api/recommendations");
    expect(res.status).toBe(400);
  });
});
