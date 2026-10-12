const connectDatabase = require("../config/database");
const app = require("../app");
const mongoose = require("mongoose");
const http = require("http");
const Program = require("../models/Program");
const Application = require("../models/Application");
const Student = require("../models/Student");

async function runTests() {
  console.log("=== PHASE 4 APPLICATION LIFECYCLE VERIFICATION SUITE ===");

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
    console.log("--- 1. Authenticating Student & Counselor ---");
    const aaravLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "aarav@example.com", password: "Candidate123!" }),
    });
    const aaravLogin = await aaravLoginRes.json();
    const aaravToken = aaravLogin.data.token;
    const aaravId = aaravLogin.data.user._id;

    const saraLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "sara@example.com", password: "Candidate123!" }),
    });
    const saraLogin = await saraLoginRes.json();
    const saraToken = saraLogin.data.token;

    const counselorLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "counselor@example.com", password: "Candidate123!" }),
    });
    const counselorLogin = await counselorLoginRes.json();
    const counselorToken = counselorLogin.data.token;

    assert(Boolean(aaravToken), "Student (Aarav) authenticated");
    assert(Boolean(saraToken), "Student (Sara) authenticated");
    assert(Boolean(counselorToken), "Counselor authenticated");

    const sampleProgram = await Program.findOne({ intakes: { $in: ["September"] } });
    assert(Boolean(sampleProgram), "Found sample program for testing application");

    await Application.deleteMany({
      student: aaravId,
      program: sampleProgram._id,
      intake: "September",
    });

    console.log("\n--- 2. Testing Application Submission ---");
    const applyRes = await fetch(`${baseUrl}/applications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aaravToken}`,
      },
      body: JSON.stringify({
        programId: sampleProgram._id,
        intake: "September",
        note: "Initial submission by student.",
      }),
    });
    const applyData = await applyRes.json();
    assert(applyRes.status === 201, "POST /applications returns HTTP 201 Created");
    assert(applyData.success === true, "Application creation success === true");
    assert(applyData.data?.status === "submitted", "Initial status is 'submitted'");
    assert(applyData.data?.destinationCountry === sampleProgram.country, "Destination country populated");
    assert(applyData.data?.statusHistory?.length === 1, "Initial statusHistory created");
    assert(applyData.data?.statusHistory[0]?.status === "submitted", "statusHistory status is 'submitted'");
    assert(applyData.data?.statusHistory[0]?.changedByRole === "student", "statusHistory recorded changedByRole 'student'");

    const createdAppId = applyData.data._id;

    console.log("\n--- 3. Testing Duplicate Prevention ---");
    const dupApplyRes = await fetch(`${baseUrl}/applications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aaravToken}`,
      },
      body: JSON.stringify({
        programId: sampleProgram._id,
        intake: "September",
        note: "Duplicate application attempt.",
      }),
    });
    const dupApplyData = await dupApplyRes.json();
    assert(dupApplyRes.status === 409, "Duplicate application returns HTTP 409 Conflict");
    assert(dupApplyData.success === false, "Duplicate application success === false");
    assert(dupApplyData.message.toLowerCase().includes("duplicate"), "Message clearly notes duplicate error");

    console.log("\n--- 4. Testing Role Rules on Status Advancement ---");
    const studentAdvanceRes = await fetch(`${baseUrl}/applications/${createdAppId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aaravToken}`,
      },
      body: JSON.stringify({
        status: "under-review",
        note: "Student trying to approve their own app.",
      }),
    });
    const studentAdvanceData = await studentAdvanceRes.json();
    assert(studentAdvanceRes.status === 403, "Student cannot advance status HTTP 403 Forbidden");
    assert(studentAdvanceData.success === false, "Student advancement rejected");

    console.log("\n--- 5. Testing Counselor Valid Lifecycle Progression ---");

    const step1Res = await fetch(`${baseUrl}/applications/${createdAppId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${counselorToken}`,
      },
      body: JSON.stringify({
        status: "under-review",
        note: "Counselor reviewed documents.",
      }),
    });
    const step1Data = await step1Res.json();
    assert(step1Res.status === 200, "Counselor: submitted -> under-review HTTP 200");
    assert(step1Data.data?.status === "under-review", "Status is 'under-review'");
    assert(step1Data.data?.statusHistory?.length === 2, "statusHistory has 2 entries");
    assert(step1Data.data?.statusHistory[1]?.changedByRole === "counselor", "Recorded counselor role");

    const step2Res = await fetch(`${baseUrl}/applications/${createdAppId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${counselorToken}`,
      },
      body: JSON.stringify({
        status: "offer-received",
        note: "Offer letter issued by university.",
      }),
    });
    const step2Data = await step2Res.json();
    assert(step2Res.status === 200, "Counselor: under-review -> offer-received HTTP 200");
    assert(step2Data.data?.status === "offer-received", "Status is 'offer-received'");

    const step3Res = await fetch(`${baseUrl}/applications/${createdAppId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${counselorToken}`,
      },
      body: JSON.stringify({
        status: "visa-processing",
        note: "Visa filing in progress.",
      }),
    });
    const step3Data = await step3Res.json();
    assert(step3Res.status === 200, "Counselor: offer-received -> visa-processing HTTP 200");
    assert(step3Data.data?.status === "visa-processing", "Status is 'visa-processing'");

    const step4Res = await fetch(`${baseUrl}/applications/${createdAppId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${counselorToken}`,
      },
      body: JSON.stringify({
        status: "enrolled",
        note: "Student successfully enrolled at university.",
      }),
    });
    const step4Data = await step4Res.json();
    assert(step4Res.status === 200, "Counselor: visa-processing -> enrolled HTTP 200");
    assert(step4Data.data?.status === "enrolled", "Status is 'enrolled'");
    assert(step4Data.data?.statusHistory?.length === 5, "statusHistory tracks complete journey (5 steps)");

    console.log("\n--- 6. Testing Invalid Status Transitions ---");
    const invalidTerminalRes = await fetch(`${baseUrl}/applications/${createdAppId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${counselorToken}`,
      },
      body: JSON.stringify({
        status: "submitted",
        note: "Attempting to reset terminal state.",
      }),
    });
    const invalidTerminalData = await invalidTerminalRes.json();
    assert(invalidTerminalRes.status === 400, "Transition from terminal state HTTP 400 Bad Request");
    assert(invalidTerminalData.success === false, "Terminal transition rejected");

    const badStatusRes = await fetch(`${baseUrl}/applications/${createdAppId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${counselorToken}`,
      },
      body: JSON.stringify({ status: "not-a-valid-status" }),
    });
    assert(badStatusRes.status === 400, "Unknown status string HTTP 400");

    console.log("\n--- 7. Testing Student Withdrawal Lifecycle ---");
    const prog2 = await Program.findOne({ _id: { $ne: sampleProgram._id } });
    await Application.deleteMany({
      student: aaravId,
      program: prog2._id,
      intake: prog2.intakes[0] || "January",
    });

    const app2Res = await fetch(`${baseUrl}/applications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aaravToken}`,
      },
      body: JSON.stringify({
        programId: prog2._id,
        intake: prog2.intakes[0] || "January",
        note: "Second application to test withdrawal.",
      }),
    });
    const app2Data = await app2Res.json();
    const app2Id = app2Data.data._id;
    assert(Boolean(app2Id), "Created second test application for withdrawal");

    const withdrawRes = await fetch(`${baseUrl}/applications/${app2Id}/withdraw`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aaravToken}`,
      },
      body: JSON.stringify({ note: "Candidate chose a different destination." }),
    });
    const withdrawData = await withdrawRes.json();
    assert(withdrawRes.status === 200, "Student withdraw own application HTTP 200 OK");
    assert(withdrawData.data?.status === "withdrawn", "Status transitioned to 'withdrawn'");
    assert(
      withdrawData.data?.statusHistory.some((h) => h.status === "withdrawn" && h.changedByRole === "student"),
      "Withdrawal recorded in statusHistory with student role"
    );

    console.log("\n--- 8. Testing Cross-Student Authorization ---");
    const saraViewRes = await fetch(`${baseUrl}/applications/${createdAppId}`, {
      headers: { Authorization: `Bearer ${saraToken}` },
    });
    assert(saraViewRes.status === 403, "Student viewing another student's app HTTP 403 Forbidden");

    const saraWithdrawRes = await fetch(`${baseUrl}/applications/${createdAppId}/withdraw`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${saraToken}`,
      },
    });
    assert(saraWithdrawRes.status === 403, "Student modifying another student's app HTTP 403 Forbidden");

    console.log("\n--- 9. Testing Application Listing Role Filtering ---");
    const studentListRes = await fetch(`${baseUrl}/applications`, {
      headers: { Authorization: `Bearer ${aaravToken}` },
    });
    const studentList = await studentListRes.json();
    assert(studentList.data.every((a) => a.student._id === aaravId), "Student list only contains own applications");

    const counselorListRes = await fetch(`${baseUrl}/applications`, {
      headers: { Authorization: `Bearer ${counselorToken}` },
    });
    const counselorList = await counselorListRes.json();
    assert(counselorList.data.length >= studentList.data.length, "Counselor can view across all students");

    console.log("\n--- 10. Testing Admin Status Advancement ---");
    const adminUser = await Student.create({
      fullName: "Platform Administrator",
      email: `admin_${Date.now()}@example.com`,
      password: "SecureAdminPassword123!",
      role: "admin",
    });

    const adminLoginRes = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: adminUser.email, password: "SecureAdminPassword123!" }),
    });
    const adminLogin = await adminLoginRes.json();
    const adminToken = adminLogin.data.token;
    assert(Boolean(adminToken), "Admin authenticated successfully");

    const adminViewRes = await fetch(`${baseUrl}/applications/${createdAppId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminViewRes.status === 200, "Admin can view any student application HTTP 200");

    const adminTestApp = await Application.create({
      student: aaravId,
      program: sampleProgram._id,
      university: sampleProgram.university,
      destinationCountry: sampleProgram.country,
      intake: "AdminSpringIntake",
      status: "submitted",
      statusHistory: [
        {
          status: "submitted",
          changedBy: aaravId,
          changedByRole: "student",
          note: "Submitted for admin test",
        },
      ],
    });

    const adminAdvanceRes = await fetch(`${baseUrl}/applications/${adminTestApp._id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        status: "under-review",
        note: "Admin reviewed application.",
      }),
    });
    const adminAdvanceData = await adminAdvanceRes.json();
    assert(adminAdvanceRes.status === 200, "Admin can advance status HTTP 200 OK");
    assert(adminAdvanceData.data.status === "under-review", "Admin successfully moved status to 'under-review'");
    const lastHistory = adminAdvanceData.data.statusHistory[adminAdvanceData.data.statusHistory.length - 1];
    assert(lastHistory.changedByRole === "admin", "statusHistory recorded changedByRole as 'admin'");

    await Application.findByIdAndDelete(app2Id);
    await Application.findByIdAndDelete(adminTestApp._id);
    await Student.findByIdAndDelete(adminUser._id);

    console.log(`\n========================================`);
    console.log(`TOTAL PHASE 4 TESTS: ${passed + failed}`);
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
