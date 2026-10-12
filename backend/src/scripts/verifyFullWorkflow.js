const http = require("http");
const mongoose = require("mongoose");
const app = require("../app");
const env = require("../config/env");
const { setupTestDB, teardownTestDB, seedTestDB } = require("../../tests/setup");
const Student = require("../models/Student");
const Program = require("../models/Program");
const Application = require("../models/Application");

let server;
let baseUrl;
let usingMemoryServer = false;

let testPassed = 0;
let testFailed = 0;

function pass(name, detail = "") {
  testPassed++;
  console.log(`  [PASS] ${name}${detail ? ` (${detail})` : ""}`);
}

function fail(name, err) {
  testFailed++;
  console.error(`  [FAIL] ${name}:`, err);
}

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const token = options.token;
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  const fetchOpts = {
    method: options.method || "GET",
    headers,
    ...(options.body ? { body: options.body } : {}),
  };
  const res = await fetch(url, fetchOpts);
  const data = await res.json().catch(() => null);
  return { status: res.status, data, headers: res.headers };
}

async function run() {
  console.log("================================================================================");
  console.log("       STARTING COMPLETE END-TO-END APPLICATION & AI WORKFLOW AUDIT            ");
  console.log("================================================================================");

  try {
    if (mongoose.connection.readyState !== 1) {
      if (env.mongoUri && !env.mongoUri.includes("localhost")) {
        console.log("Connecting to configured MongoDB Atlas...");
        try {
          await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5000 });
          console.log("Connected to MongoDB Atlas.");
        } catch (e) {
          console.log("Atlas connection timed out. Falling back to MongoDB Memory Server.");
          await setupTestDB();
          await seedTestDB();
          usingMemoryServer = true;
        }
      } else {
        await setupTestDB();
        await seedTestDB();
        usingMemoryServer = true;
      }
    }

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}/api`;
    console.log(`Test API listening at ${baseUrl}\n`);

    console.log("--- 1. Healthcheck & System Status ---");
    const health = await request("/health");
    if (health.status === 200 && health.data.success) {
      pass("GET /api/health", `database: ${health.data.data?.database}`);
    } else {
      fail("GET /api/health", health.data);
    }

    console.log("\n--- 2. Authentication, Registration & Profile Management ---");
    const testEmail = `student_${Date.now()}@example.com`;
    const regRes = await request("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        fullName: "Dev Workflow Student",
        email: testEmail,
        password: "Password123!",
        role: "student",
        budget: 38000,
        preferredCountries: ["Canada", "United Kingdom"],
        fieldOfStudy: ["Computer Science"],
        intake: "Fall 2025",
        ieltsScore: 7.5,
      }),
    });
    if (regRes.status === 201 && regRes.data.data?.token) {
      pass("Student Registration", `User ID: ${regRes.data.data.user?._id || regRes.data.data.user?.id}`);
    } else {
      fail("Student Registration", regRes.data);
    }
    const newStudentToken = regRes.data.data?.token;

    const dupRegRes = await request("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        fullName: "Dev Workflow Student Duplicate",
        email: testEmail,
        password: "Password123!",
      }),
    });
    if (dupRegRes.status === 409) {
      pass("Duplicate Registration Rejection (HTTP 409 Conflict)");
    } else {
      fail("Duplicate Registration Rejection", dupRegRes.status);
    }

    const loginAarav = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "aarav@example.com",
        password: "Candidate123!",
      }),
    });
    if (loginAarav.status === 200 && loginAarav.data.data?.token) {
      pass("Login with Seeded Student (aarav@example.com)");
    } else {
      fail("Login with Seeded Student", loginAarav.data);
    }
    const aaravToken = loginAarav.data.data?.token;

    const loginCounselor = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "counselor@example.com",
        password: "Candidate123!",
      }),
    });
    if (loginCounselor.status === 200 && loginCounselor.data.data?.user?.role === "counselor") {
      pass("Login with Seeded Counselor (counselor@example.com)");
    } else {
      fail("Login with Seeded Counselor", loginCounselor.data);
    }
    const counselorToken = loginCounselor.data.data?.token;

    const profileRes = await request("/auth/profile", { token: aaravToken });
    if (profileRes.status === 200 && profileRes.data.data?.email === "aarav@example.com") {
      pass("Fetch Student Profile via JWT token");
    } else {
      fail("Fetch Student Profile", profileRes.data);
    }

    const updateProfileRes = await request("/auth/profile", {
      method: "PUT",
      token: aaravToken,
      body: JSON.stringify({
        budget: 36000,
        preferredCountries: ["Canada", "UAE"],
        fieldOfStudy: ["Computer Science", "Data Science"],
        intake: "Fall 2025",
        ieltsScore: 7.0,
      }),
    });
    if (updateProfileRes.status === 200 && updateProfileRes.data.data?.budget === 36000) {
      pass("Update Student Profile Preferences");
    } else {
      fail("Update Student Profile", updateProfileRes.data);
    }

    console.log("\n--- 3. University & Program Discovery Engine ---");
    const uniRes = await request("/universities?page=1&limit=5");
    if (uniRes.status === 200 && Array.isArray(uniRes.data.data)) {
      pass("Universities Discovery", `Total count: ${uniRes.data.meta?.total || uniRes.data.data.length}`);
    } else {
      fail("Universities Discovery", uniRes.data);
    }

    const progRes = await request("/programs?country=Canada&maxTuition=40000");
    if (progRes.status === 200 && Array.isArray(progRes.data.data) && progRes.data.data.length > 0) {
      pass("Programs Filtered Discovery", `Found ${progRes.data.data.length} Canada programs <= $40k`);
    } else {
      fail("Programs Filtered Discovery", progRes.data);
    }

    const targetProgram = progRes.data.data[0];
    const progDetailRes = await request(`/programs/${targetProgram._id}`);
    if (progDetailRes.status === 200 && progDetailRes.data.data?._id === targetProgram._id) {
      pass("Program Detail by ID", targetProgram.title);
    } else {
      fail("Program Detail by ID", progDetailRes.data);
    }

    console.log("\n--- 4. Recommendation Engine (5-Factor Weighted Scoring) ---");
    const recRes = await request("/recommendations", { token: aaravToken });
    const recList = recRes.data.data?.recommendations || (Array.isArray(recRes.data.data) ? recRes.data.data : []);
    if (recRes.status === 200 && Array.isArray(recList) && recList.length > 0) {
      const topRec = recList[0];
      const hasScore = typeof topRec.score === "number" && topRec.score >= 0 && topRec.score <= 100;
      const hasReasons = Array.isArray(topRec.matchReasons) && topRec.matchReasons.length > 0;
      if (hasScore && hasReasons) {
        pass("Personalized Recommendations", `Top match: ${topRec.program?.title} (${topRec.score}%)`);
      } else {
        fail("Personalized Recommendations Shape", topRec);
      }
    } else {
      fail("Personalized Recommendations", recRes.data);
    }

    console.log("\n--- 5. Application Lifecycle & State Machine Transitions ---");
    const allPrograms = await Program.find().limit(3);
    const prog1 = allPrograms[0];
    const prog2 = allPrograms[1];

    const applyRes = await request("/applications", {
      method: "POST",
      token: newStudentToken,
      body: JSON.stringify({
        programId: prog1._id.toString(),
        intake: prog1.intake || "September",
        notes: "End-to-end verification application.",
      }),
    });
    let appId;
    if (applyRes.status === 201 && applyRes.data.data?.status === "submitted") {
      appId = applyRes.data.data._id;
      pass("Submit Application", `Initial status: submitted, ID: ${appId}`);
    } else {
      fail("Submit Application", applyRes.data);
    }

    const dupApplyRes = await request("/applications", {
      method: "POST",
      token: newStudentToken,
      body: JSON.stringify({
        programId: prog1._id.toString(),
        intake: prog1.intake || "September",
      }),
    });
    if (dupApplyRes.status === 409) {
      pass("Duplicate Application Prevention (HTTP 409 Conflict)");
    } else {
      fail("Duplicate Application Prevention", dupApplyRes.status);
    }

    const trans1 = await request(`/applications/${appId}/status`, {
      method: "PATCH",
      token: counselorToken,
      body: JSON.stringify({
        status: "under-review",
        note: "Documents under review by admissions counselor.",
      }),
    });
    if (trans1.status === 200 && trans1.data.data?.status === "under-review") {
      pass("Counselor Advance Status", "submitted -> under-review");
    } else {
      fail("Counselor Advance Status", trans1.data);
    }

    const trans2 = await request(`/applications/${appId}/status`, {
      method: "PATCH",
      token: counselorToken,
      body: JSON.stringify({
        status: "offer-received",
        note: "Conditional offer letter issued by university.",
      }),
    });
    if (trans2.status === 200 && trans2.data.data?.status === "offer-received") {
      pass("Counselor Advance Status", "under-review -> offer-received");
    } else {
      fail("Counselor Advance Status 2", trans2.data);
    }

    const studentAdvance = await request(`/applications/${appId}/status`, {
      method: "PATCH",
      token: newStudentToken,
      body: JSON.stringify({
        status: "visa-processing",
      }),
    });
    if (studentAdvance.status === 403) {
      pass("Role Rule: Student cannot advance status (HTTP 403 Forbidden)");
    } else {
      fail("Role Rule Check", studentAdvance.status);
    }

    const invalidJump = await request(`/applications/${appId}/status`, {
      method: "PATCH",
      token: counselorToken,
      body: JSON.stringify({
        status: "submitted",
      }),
    });
    if (invalidJump.status === 400) {
      pass("Invalid Status Transition Rejection (HTTP 400 Bad Request)");
    } else {
      fail("Invalid Status Transition Rejection", invalidJump.status);
    }

    const applyRes2 = await request("/applications", {
      method: "POST",
      token: newStudentToken,
      body: JSON.stringify({
        programId: prog2._id.toString(),
        intake: prog2.intake || "January",
      }),
    });
    const app2Id = applyRes2.data.data?._id;
    const withdrawRes = await request(`/applications/${app2Id}/status`, {
      method: "PATCH",
      token: newStudentToken,
      body: JSON.stringify({
        status: "withdrawn",
        note: "Student decided to pursue other alternatives.",
      }),
    });
    if (withdrawRes.status === 200 && withdrawRes.data.data?.status === "withdrawn") {
      pass("Student Self-Withdrawal", "Status changed to withdrawn");
    } else {
      fail("Student Self-Withdrawal", withdrawRes.data);
    }

    const appDetailRes = await request(`/applications/${appId}`, { token: counselorToken });
    const history = appDetailRes.data.data?.statusHistory;
    if (Array.isArray(history) && history.length >= 3) {
      pass("Application Status History Audit Trail", `${history.length} logged state transitions with timestamps and actors`);
    } else {
      fail("Application Status History Audit Trail", history);
    }

    console.log("\n--- 6. AI Study Planning & Insights (Groq LLM Integration) ---");

    console.log("Testing POST /api/ai/study-plan...");
    const planRes = await request("/ai/study-plan", {
      method: "POST",
      token: aaravToken,
      body: JSON.stringify({}),
    });

    if (planRes.status === 200 && planRes.data.success) {
      const plan = planRes.data.data?.studyPlan;
      const meta = planRes.data.meta;
      pass("POST /api/ai/study-plan HTTP 200", `source: ${meta?.source}, model: ${meta?.model || "rule-based"}`);

      if (typeof plan.summary === "string" && plan.summary.length > 10) {
        pass("Study Plan summary field present and informative");
      } else {
        fail("Study Plan summary field", plan.summary);
      }

      if (Array.isArray(plan.shortlist) && plan.shortlist.length >= 1) {
        pass("Study Plan shortlist present", `${plan.shortlist.length} programs shortlisted`);
        const item = plan.shortlist[0];
        const hasProps = Boolean(item.programTitle && item.university && typeof item.tuitionFeeUsd === "number");
        if (hasProps) {
          pass("Shortlist item fields valid", `programTitle, university, tuitionFeeUsd, ieltsGap (${item.ieltsGap})`);
        } else {
          fail("Shortlist item fields", item);
        }
      } else {
        fail("Study Plan shortlist", plan.shortlist);
      }

      if (Array.isArray(plan.timeline) && plan.timeline.length > 0) {
        pass("Study Plan timeline present", `${plan.timeline.length} milestone steps`);
      } else {
        fail("Study Plan timeline", plan.timeline);
      }

      if (Array.isArray(plan.documentsChecklist) && plan.documentsChecklist.length > 0) {
        pass("Study Plan documentsChecklist present", `${plan.documentsChecklist.length} required documents`);
      } else {
        fail("Study Plan documentsChecklist", plan.documentsChecklist);
      }

      if (typeof plan.budgetNotes === "string" && plan.budgetNotes.length > 10) {
        pass("Study Plan budgetNotes present");
      } else {
        fail("Study Plan budgetNotes", plan.budgetNotes);
      }

      if (Array.isArray(plan.nextSteps) && plan.nextSteps.length > 0) {
        pass("Study Plan nextSteps present", `${plan.nextSteps.length} actionable next steps`);
      } else {
        fail("Study Plan nextSteps", plan.nextSteps);
      }
    } else {
      fail("POST /api/ai/study-plan", planRes.data);
    }

    console.log("\nTesting POST /api/ai/recommendation-insights...");
    const insightsRes = await request("/ai/recommendation-insights", {
      method: "POST",
      token: aaravToken,
      body: JSON.stringify({}),
    });

    if (insightsRes.status === 200 && insightsRes.data.success) {
      const insightsData = insightsRes.data.data;
      const meta = insightsRes.data.meta;
      pass("POST /api/ai/recommendation-insights HTTP 200", `source: ${meta?.source}, model: ${meta?.model || "rule-based"}`);

      if (Array.isArray(insightsData.insights) && insightsData.insights.length > 0) {
        pass("AI Insights array present", `${insightsData.insights.length} program insights`);
        const first = insightsData.insights[0];
        if (first.programTitle && first.whyItFits && first.watchOut) {
          pass("AI Insight item contains whyItFits & watchOut", `Program: ${first.programTitle}`);
        } else {
          fail("AI Insight item missing required properties", first);
        }
      } else {
        fail("AI Insights array", insightsData.insights);
      }

      if (typeof insightsData.overallAdvice === "string" && insightsData.overallAdvice.length > 10) {
        pass("AI Insights overallAdvice present");
      } else {
        fail("AI Insights overallAdvice", insightsData.overallAdvice);
      }
    } else {
      fail("POST /api/ai/recommendation-insights", insightsRes.data);
    }

    const counselorAi = await request("/ai/study-plan", {
      method: "POST",
      token: counselorToken,
    });
    if (counselorAi.status === 403) {
      pass("Counselor Forbidden on AI Study Plan (HTTP 403 Student Only)");
    } else {
      fail("Counselor Forbidden on AI Study Plan", counselorAi.status);
    }

    const incompleteEmail = `incomplete_${Date.now()}@example.com`;
    const incReg = await request("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        fullName: "Incomplete Profile Student",
        email: incompleteEmail,
        password: "Password123!",
        role: "student",
      }),
    });
    const incToken = incReg.data.data?.token;
    const incAiRes = await request("/ai/study-plan", {
      method: "POST",
      token: incToken,
    });
    if (incAiRes.status === 400 && incAiRes.data.message?.includes("Missing required fields")) {
      pass("Incomplete Profile Validation (HTTP 400 with missing fields message)", incAiRes.data.message);
    } else {
      fail("Incomplete Profile Validation", incAiRes.data);
    }

  } catch (err) {
    console.error("Fatal audit error:", err);
    testFailed++;
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (usingMemoryServer) {
      await teardownTestDB();
    }
    console.log("\n================================================================================");
    console.log(`WORKFLOW AUDIT COMPLETE: ${testPassed} PASSED, ${testFailed} FAILED`);
    console.log("================================================================================");
    process.exit(testFailed > 0 ? 1 : 0);
  }
}

run();
