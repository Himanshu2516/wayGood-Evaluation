const request = require("supertest");
const app = require("../src/app");
const { setupTestDB, teardownTestDB, seedTestDB } = require("./setup");
const Program = require("../src/models/Program");
const Application = require("../src/models/Application");
const Student = require("../src/models/Student");

describe("Application Lifecycle, State Machine & Role Rules", () => {
  let studentAaravToken;
  let studentSaraToken;
  let counselorToken;
  let adminToken;
  let sampleProgram;

  beforeAll(async () => {
    await setupTestDB();
    await seedTestDB();

    const aaravLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "aarav@example.com", password: "Candidate123!" });
    studentAaravToken = aaravLogin.body.data.token;

    const saraLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "sara@example.com", password: "Candidate123!" });
    studentSaraToken = saraLogin.body.data.token;

    const counselorLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "counselor@example.com", password: "Candidate123!" });
    counselorToken = counselorLogin.body.data.token;

    const adminUser = await Student.create({
      fullName: "Super Admin",
      email: "admin_test@example.com",
      password: "SecureAdminPassword123!",
      role: "admin",
    });
    const adminLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin_test@example.com", password: "SecureAdminPassword123!" });
    adminToken = adminLogin.body.data.token;

    sampleProgram = await Program.findOne({ intakes: { $in: ["September"] } });
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  describe("Application Submission & Duplicate Prevention", () => {
    let createdAppId;

    it("should allow student to apply to program, setting initial status to submitted", async () => {
      const res = await request(app)
        .post("/api/applications")
        .set("Authorization", `Bearer ${studentAaravToken}`)
        .send({
          programId: sampleProgram._id,
          intake: "September",
          note: "First submission",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("submitted");
      expect(res.body.data.destinationCountry).toBe(sampleProgram.country);
      expect(res.body.data.statusHistory.length).toBe(1);
      expect(res.body.data.statusHistory[0].status).toBe("submitted");
      expect(res.body.data.statusHistory[0].changedByRole).toBe("student");

      createdAppId = res.body.data._id;
    });

    it("should prevent duplicate application for same student, program and intake (409 Conflict)", async () => {
      const res = await request(app)
        .post("/api/applications")
        .set("Authorization", `Bearer ${studentAaravToken}`)
        .send({
          programId: sampleProgram._id,
          intake: "September",
          note: "Duplicate submission attempt",
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/duplicate application/i);
    });
  });

  describe("Status State Machine & Valid Transitions", () => {
    let testApp;

    beforeEach(async () => {
      testApp = await Application.create({
        student: (await Student.findOne({ email: "aarav@example.com" }))._id,
        program: sampleProgram._id,
        university: sampleProgram.university,
        destinationCountry: sampleProgram.country,
        intake: `Intake_${Date.now()}`,
        status: "submitted",
        statusHistory: [
          {
            status: "submitted",
            changedByRole: "student",
            note: "Initial",
            changedAt: new Date(),
          },
        ],
      });
    });

    it("should allow counselor to progress application through full lifecycle: submitted -> under-review -> offer-received -> visa-processing -> enrolled", async () => {
      const step1 = await request(app)
        .patch(`/api/applications/${testApp._id}/status`)
        .set("Authorization", `Bearer ${counselorToken}`)
        .send({ status: "under-review", note: "Counselor reviewing application" });

      expect(step1.status).toBe(200);
      expect(step1.body.data.status).toBe("under-review");
      expect(step1.body.data.statusHistory.length).toBe(2);
      expect(step1.body.data.statusHistory[1].changedByRole).toBe("counselor");

      const step2 = await request(app)
        .patch(`/api/applications/${testApp._id}/status`)
        .set("Authorization", `Bearer ${counselorToken}`)
        .send({ status: "offer-received", note: "Offer issued by university" });

      expect(step2.status).toBe(200);
      expect(step2.body.data.status).toBe("offer-received");

      const step3 = await request(app)
        .patch(`/api/applications/${testApp._id}/status`)
        .set("Authorization", `Bearer ${counselorToken}`)
        .send({ status: "visa-processing", note: "Visa docs lodged" });

      expect(step3.status).toBe(200);
      expect(step3.body.data.status).toBe("visa-processing");

      const step4 = await request(app)
        .patch(`/api/applications/${testApp._id}/status`)
        .set("Authorization", `Bearer ${counselorToken}`)
        .send({ status: "enrolled", note: "Student arrived and enrolled" });

      expect(step4.status).toBe(200);
      expect(step4.body.data.status).toBe("enrolled");
      expect(step4.body.data.statusHistory.length).toBe(5);
    });

    it("should allow admin to advance status", async () => {
      const res = await request(app)
        .patch(`/api/applications/${testApp._id}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "under-review", note: "Admin fast-track" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("under-review");
      const lastHistory = res.body.data.statusHistory[res.body.data.statusHistory.length - 1];
      expect(lastHistory.changedByRole).toBe("admin");
    });
  });

  describe("Invalid Status Transitions & Terminal States", () => {
    let testApp;

    beforeEach(async () => {
      testApp = await Application.create({
        student: (await Student.findOne({ email: "aarav@example.com" }))._id,
        program: sampleProgram._id,
        university: sampleProgram.university,
        destinationCountry: sampleProgram.country,
        intake: `Intake_${Date.now()}`,
        status: "submitted",
        statusHistory: [{ status: "submitted", changedByRole: "student" }],
      });
    });

    it("should reject invalid status jump (submitted -> enrolled) with 400 Bad Request", async () => {
      const res = await request(app)
        .patch(`/api/applications/${testApp._id}/status`)
        .set("Authorization", `Bearer ${counselorToken}`)
        .send({ status: "enrolled" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid status transition/i);
    });

    it("should reject transitions from terminal state (enrolled -> withdrawn) with 400 Bad Request", async () => {
      testApp.status = "enrolled";
      await testApp.save();

      const res = await request(app)
        .patch(`/api/applications/${testApp._id}/status`)
        .set("Authorization", `Bearer ${counselorToken}`)
        .send({ status: "withdrawn" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/terminal state/i);
    });

    it("should reject unrecognized status string with 400 Bad Request", async () => {
      const res = await request(app)
        .patch(`/api/applications/${testApp._id}/status`)
        .set("Authorization", `Bearer ${counselorToken}`)
        .send({ status: "completely-bogus-status" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("Role Rules & Permissions", () => {
    let studentApp;

    beforeEach(async () => {
      studentApp = await Application.create({
        student: (await Student.findOne({ email: "aarav@example.com" }))._id,
        program: sampleProgram._id,
        university: sampleProgram.university,
        destinationCountry: sampleProgram.country,
        intake: `Intake_Role_${Date.now()}`,
        status: "submitted",
        statusHistory: [{ status: "submitted", changedByRole: "student" }],
      });
    });

    it("should forbid student from advancing status (403 Forbidden)", async () => {
      const res = await request(app)
        .patch(`/api/applications/${studentApp._id}/status`)
        .set("Authorization", `Bearer ${studentAaravToken}`)
        .send({ status: "under-review" });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/forbidden/i);
    });

    it("should allow student to withdraw their own application", async () => {
      const res = await request(app)
        .patch(`/api/applications/${studentApp._id}/withdraw`)
        .set("Authorization", `Bearer ${studentAaravToken}`)
        .send({ note: "Student changed study plans" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("withdrawn");
      const lastHistory = res.body.data.statusHistory[res.body.data.statusHistory.length - 1];
      expect(lastHistory.status).toBe("withdrawn");
      expect(lastHistory.changedByRole).toBe("student");
    });

    it("should forbid student from viewing or withdrawing another student's application (403)", async () => {
      const viewRes = await request(app)
        .get(`/api/applications/${studentApp._id}`)
        .set("Authorization", `Bearer ${studentSaraToken}`);

      expect(viewRes.status).toBe(403);

      const withdrawRes = await request(app)
        .patch(`/api/applications/${studentApp._id}/withdraw`)
        .set("Authorization", `Bearer ${studentSaraToken}`);

      expect(withdrawRes.status).toBe(403);
    });

    it("should filter application listing by role (student sees own, counselor/admin sees all)", async () => {
      const studentList = await request(app)
        .get("/api/applications")
        .set("Authorization", `Bearer ${studentAaravToken}`);

      expect(studentList.status).toBe(200);
      const aaravId = (await Student.findOne({ email: "aarav@example.com" }))._id.toString();
      studentList.body.data.forEach((appItem) => {
        expect(appItem.student._id.toString()).toBe(aaravId);
      });

      const counselorList = await request(app)
        .get("/api/applications")
        .set("Authorization", `Bearer ${counselorToken}`);

      expect(counselorList.status).toBe(200);
      expect(counselorList.body.data.length).toBeGreaterThanOrEqual(studentList.body.data.length);
    });
  });
});
