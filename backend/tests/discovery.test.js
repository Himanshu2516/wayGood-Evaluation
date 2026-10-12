const request = require("supertest");
const app = require("../src/app");
const { setupTestDB, teardownTestDB, seedTestDB } = require("./setup");
const mongoose = require("mongoose");

describe("University & Program Discovery Endpoints", () => {
  beforeAll(async () => {
    await setupTestDB();
    await seedTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  describe("University Discovery (GET /api/universities)", () => {
    it("should list universities with pagination metadata", async () => {
      const res = await request(app).get("/api/universities?page=1&limit=3");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(3);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(3);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(3);
      expect(res.body.meta.hasNextPage).toBe(true);
    });

    it("should filter universities by country", async () => {
      const res = await request(app).get("/api/universities?country=Canada");

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      res.body.data.forEach((uni) => {
        expect(uni.country.toLowerCase()).toBe("canada");
      });
    });

    it("should filter universities by scholarship availability", async () => {
      const res = await request(app).get("/api/universities?scholarshipAvailable=true");

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      res.body.data.forEach((uni) => {
        expect(uni.scholarshipAvailable).toBe(true);
      });
    });

    it("should sanitize special regex search query parameters without crashing", async () => {
      const res = await request(app).get("/api/universities?q=Tor.*[0-9]+(?=onto)");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("should sort universities by QS ranking ascending", async () => {
      const res = await request(app).get("/api/universities?sortBy=ranking&limit=5");

      expect(res.status).toBe(200);
      for (let i = 1; i < res.body.data.length; i++) {
        expect(res.body.data[i].qsRanking).toBeGreaterThanOrEqual(res.body.data[i - 1].qsRanking);
      }
    });

    it("should return popular universities carousel", async () => {
      const res = await request(app).get("/api/universities/popular");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeLessThanOrEqual(6);
    });

    it("should get university detail by ID including associated programs", async () => {
      const listRes = await request(app).get("/api/universities?limit=1");
      const targetId = listRes.body.data[0]._id;

      const detailRes = await request(app).get(`/api/universities/${targetId}`);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data._id).toBe(targetId);
      expect(Array.isArray(detailRes.body.data.programs)).toBe(true);
    });

    it("should return 400 for invalid ID format and 404 for missing ID", async () => {
      const badRes = await request(app).get("/api/universities/not-a-valid-id");
      expect(badRes.status).toBe(400);

      const missingId = new mongoose.Types.ObjectId().toString();
      const notFoundRes = await request(app).get(`/api/universities/${missingId}`);
      expect(notFoundRes.status).toBe(404);
    });
  });

  describe("Program Discovery (GET /api/programs)", () => {
    it("should list programs with pagination and populate university reference", async () => {
      const res = await request(app).get("/api/programs?page=1&limit=4");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(4);
      expect(res.body.data[0].university).toBeDefined();
      expect(res.body.data[0].university.name).toBeDefined();
      expect(res.body.meta.page).toBe(1);
    });

    it("should filter programs by country, degreeLevel, and field", async () => {
      const res = await request(app).get("/api/programs?country=Canada&degreeLevel=master&field=Computer");

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      res.body.data.forEach((p) => {
        expect(p.country.toLowerCase()).toBe("canada");
        expect(p.degreeLevel).toBe("master");
        expect(p.field.toLowerCase()).toMatch(/computer/);
      });
    });

    it("should filter programs by intake and maximum tuition fee", async () => {
      const res = await request(app).get("/api/programs?intake=September&maxTuition=20000");

      expect(res.status).toBe(200);
      res.body.data.forEach((p) => {
        expect(p.intakes.some((i) => i.toLowerCase() === "september")).toBe(true);
        expect(p.tuitionFeeUsd).toBeLessThanOrEqual(20000);
      });
    });

    it("should filter programs by student IELTS score eligibility", async () => {
      const res = await request(app).get("/api/programs?ielts=6.5");

      expect(res.status).toBe(200);
      res.body.data.forEach((p) => {
        expect(p.minimumIelts).toBeLessThanOrEqual(6.5);
      });
    });

    it("should sort programs by tuition ascending", async () => {
      const res = await request(app).get("/api/programs?sortBy=tuitionAsc&limit=5");

      expect(res.status).toBe(200);
      for (let i = 1; i < res.body.data.length; i++) {
        expect(res.body.data[i].tuitionFeeUsd).toBeGreaterThanOrEqual(res.body.data[i - 1].tuitionFeeUsd);
      }
    });

    it("should get program by ID", async () => {
      const listRes = await request(app).get("/api/programs?limit=1");
      const sampleId = listRes.body.data[0]._id;

      const detailRes = await request(app).get(`/api/programs/${sampleId}`);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data._id).toBe(sampleId);
      expect(detailRes.body.data.university.name).toBeDefined();
    });
  });
});
