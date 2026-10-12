const request = require("supertest");
const app = require("../src/app");
const { setupTestDB, teardownTestDB, seedTestDB } = require("./setup");
const Student = require("../src/models/Student");

describe("Authentication & Profile Endpoints", () => {
  beforeAll(async () => {
    await setupTestDB();
    await seedTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  describe("POST /api/auth/register", () => {
    it("should register a new student with profile fields and return JWT without password", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          fullName: "Rohan Verma",
          email: "rohan@example.com",
          password: "SecurePassword123!",
          role: "student",
          preferredCountries: ["Germany", "Sweden"],
          budget: 20000,
          fieldOfStudy: ["Robotics"],
          intake: "September",
          ieltsScore: 7.5,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe("rohan@example.com");
      expect(res.body.data.user.fullName).toBe("Rohan Verma");
      expect(res.body.data.user.budget).toBe(20000);
      expect(res.body.data.user.ieltsScore).toBe(7.5);
      expect(res.body.data.user.preferredCountries).toEqual(["Germany", "Sweden"]);
      expect(res.body.data.user.password).toBeUndefined();
    });

    it("should reject duplicate registration with 409 Conflict", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          fullName: "Duplicate User",
          email: "rohan@example.com",
          password: "SecurePassword123!",
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it("should validate required fields and constraints with 400 Bad Request", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          fullName: "A",
          email: "not-an-email",
          password: "123",
          budget: -100,
          ieltsScore: 12,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.details).toBeDefined();
      expect(res.body.details.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("POST /api/auth/login", () => {
    it("should log in an existing student and return JWT token without password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "aarav@example.com",
          password: "Candidate123!",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.password).toBeUndefined();
      expect(res.body.data.user.email).toBe("aarav@example.com");
    });

    it("should return 401 Unauthorized for incorrect password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "aarav@example.com",
          password: "IncorrectPassword!",
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid email or password/i);
    });

    it("should return 401 Unauthorized for non-existent email", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "ghost@example.com",
          password: "Candidate123!",
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe("Protected Profile GET & PUT /api/auth/profile", () => {
    let studentToken;

    beforeAll(async () => {
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: "aarav@example.com", password: "Candidate123!" });
      studentToken = loginRes.body.data.token;
    });

    it("should reject unauthenticated profile requests with 401", async () => {
      const res = await request(app).get("/api/auth/profile");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should retrieve profile with valid JWT Bearer token", async () => {
      const res = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe("aarav@example.com");
      expect(res.body.data.password).toBeUndefined();
    });

    it("should update profile fields successfully via PUT /api/auth/profile", async () => {
      const res = await request(app)
        .put("/api/auth/profile")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          fullName: "Aarav Malhotra Updated",
          budget: 27000,
          ieltsScore: 7.5,
          intake: "Fall 2026",
          preferredCountries: ["Canada", "Germany"],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.fullName).toBe("Aarav Malhotra Updated");
      expect(res.body.data.budget).toBe(27000);
      expect(res.body.data.ieltsScore).toBe(7.5);
      expect(res.body.data.intake).toBe("Fall 2026");
      expect(res.body.data.password).toBeUndefined();
    });

    it("should reject invalid profile updates with 400 Bad Request", async () => {
      const res = await request(app)
        .put("/api/auth/profile")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          budget: -500,
          ieltsScore: 11,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.details).toBeDefined();
    });
  });

  describe("Role-Based Middleware Verification", () => {
    let studentToken;
    let counselorToken;

    beforeAll(async () => {
      const studentLogin = await request(app)
        .post("/api/auth/login")
        .send({ email: "aarav@example.com", password: "Candidate123!" });
      studentToken = studentLogin.body.data.token;

      const counselorLogin = await request(app)
        .post("/api/auth/login")
        .send({ email: "counselor@example.com", password: "Candidate123!" });
      counselorToken = counselorLogin.body.data.token;
    });

    it("should forbid student from accessing counselor endpoint with 403", async () => {
      const res = await request(app)
        .get("/api/auth/counselor-test")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/forbidden/i);
    });

    it("should allow counselor to access counselor endpoint with 200", async () => {
      const res = await request(app)
        .get("/api/auth/counselor-test")
        .set("Authorization", `Bearer ${counselorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/counselor access granted/i);
    });
  });

  describe("Document Vault & Profile Management", () => {
    let studentToken;
    let uploadedDocId;

    beforeAll(async () => {
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: "aarav@example.com", password: "Candidate123!" });
      studentToken = loginRes.body.data.token;
    });

    it("should update extended profile details (phone, currentEducation, gpa)", async () => {
      const res = await request(app)
        .put("/api/auth/profile")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          phone: "+1-555-0199",
          currentEducation: "B.Tech Computer Science",
          gpa: "3.9 / 4.0",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.phone).toBe("+1-555-0199");
      expect(res.body.data.currentEducation).toBe("B.Tech Computer Science");
      expect(res.body.data.gpa).toBe("3.9 / 4.0");
    });

    it("should upload a document to the student's vault (POST /api/auth/documents)", async () => {
      const res = await request(app)
        .post("/api/auth/documents")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          title: "Undergraduate Transcript",
          documentType: "transcripts",
          fileName: "transcript_sem1_8.pdf",
          fileSize: 1048576,
          mimeType: "application/pdf",
          fileData: "data:application/pdf;base64,JVBERi0xLjQK...",
          notes: "Official attested transcript copy",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.documents)).toBe(true);
      expect(res.body.data.documents.length).toBeGreaterThan(0);

      const doc = res.body.data.documents.find((d) => d.title === "Undergraduate Transcript");
      expect(doc).toBeDefined();
      expect(doc.documentType).toBe("transcripts");
      expect(doc.fileName).toBe("transcript_sem1_8.pdf");
      expect(doc.status).toBe("uploaded");
      uploadedDocId = doc._id;
    });

    it("should reject document upload with missing title or fileName (400)", async () => {
      const res = await request(app)
        .post("/api/auth/documents")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          documentType: "passport",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject document upload when unauthenticated (401)", async () => {
      const res = await request(app)
        .post("/api/auth/documents")
        .send({
          title: "Passport Copy",
          fileName: "passport.pdf",
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should delete an uploaded document (DELETE /api/auth/documents/:documentId)", async () => {
      expect(uploadedDocId).toBeDefined();

      const res = await request(app)
        .delete(`/api/auth/documents/${uploadedDocId}`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const stillExists = (res.body.data.documents || []).some(
        (d) => d._id === uploadedDocId
      );
      expect(stillExists).toBe(false);
    });

    it("should return 404 when deleting a non-existent document", async () => {
      const res = await request(app)
        .delete("/api/auth/documents/60c72b2f9b1d8b2bad123456")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
