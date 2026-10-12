const mongoose = require("mongoose");
const connectDatabase = require("../config/database");
const University = require("../models/University");
const Program = require("../models/Program");
const Application = require("../models/Application");
const Student = require("../models/Student");

async function runExplainVerification() {
  console.log("=== PERFORMANCE & INDEX EXPLAIN VERIFICATION SUITE ===\n");

  await connectDatabase();

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

  function extractStages(plan) {
    const stages = [];
    function traverse(node) {
      if (!node) return;
      if (node.stage) stages.push(node.stage);
      if (node.inputStage) traverse(node.inputStage);
      if (node.inputStages) node.inputStages.forEach(traverse);
    }
    traverse(plan);
    return stages;
  }

  try {
    console.log("--- 1. University Country & Scholarship Index Scan ---");
    const uniExplain = await University.find({ country: "Canada", scholarshipAvailable: true })
      .select("name country city qsRanking popularScore scholarshipAvailable")
      .explain("executionStats");

    const uniWinningPlan = uniExplain.queryPlanner.winningPlan;
    const uniStages = extractStages(uniWinningPlan);
    const uniStats = uniExplain.executionStats;

    console.log(`Stages traversed: ${uniStages.join(" -> ")}`);
    console.log(`Execution time: ${uniStats.executionTimeMillis} ms | Docs examined: ${uniStats.totalDocsExamined} | Keys examined: ${uniStats.totalKeysExamined}`);
    assert(uniStages.includes("IXSCAN"), "University query uses IXSCAN (Index Scan)");
    assert(!uniStages.includes("COLLSCAN"), "University query avoids COLLSCAN (Collection Scan)");

    console.log("\n--- 2. University Popularity & QS Ranking Compound Index ---");
    const popExplain = await University.find()
      .sort({ popularScore: -1, qsRanking: 1 })
      .limit(6)
      .explain("executionStats");

    const popStages = extractStages(popExplain.queryPlanner.winningPlan);
    const popStats = popExplain.executionStats;

    console.log(`Stages traversed: ${popStages.join(" -> ")}`);
    console.log(`Execution time: ${popStats.executionTimeMillis} ms | Docs examined: ${popStats.totalDocsExamined} | Keys examined: ${popStats.totalKeysExamined}`);
    assert(popStages.includes("IXSCAN"), "Popular universities query uses IXSCAN");
    assert(!popStages.includes("SORT"), "In-memory SORT avoided via indexed order");

    console.log("\n--- 3. Program Compound Filter (Country + Degree + Field + Tuition) ---");
    const progExplain = await Program.find({
      country: "UK",
      degreeLevel: "master",
      field: "Computer Science",
      tuitionFeeUsd: { $lte: 30000 },
    })
      .select("title universityName country field tuitionFeeUsd")
      .explain("executionStats");

    const progStages = extractStages(progExplain.queryPlanner.winningPlan);
    const progStats = progExplain.executionStats;

    console.log(`Stages traversed: ${progStages.join(" -> ")}`);
    console.log(`Execution time: ${progStats.executionTimeMillis} ms | Docs examined: ${progStats.totalDocsExamined} | Keys examined: ${progStats.totalKeysExamined}`);
    assert(progStages.includes("IXSCAN"), "Program compound filter uses IXSCAN");
    assert(!progStages.includes("COLLSCAN"), "Program query avoids COLLSCAN");

    console.log("\n--- 4. Program Scholarship + Tuition Sort Index ---");
    const scholarProgExplain = await Program.find({ scholarshipAvailable: true })
      .sort({ scholarshipAvailable: -1, tuitionFeeUsd: 1 })
      .limit(5)
      .explain("executionStats");

    const scholarProgStages = extractStages(scholarProgExplain.queryPlanner.winningPlan);
    console.log(`Stages traversed: ${scholarProgStages.join(" -> ")}`);
    assert(scholarProgStages.includes("IXSCAN"), "Scholarship program query uses IXSCAN");

    console.log("\n--- 5. Application Unique Compound Index ({ student, program, intake }) ---");
    const sampleStudent = await Student.findOne();
    const sampleProg = await Program.findOne();

    if (sampleStudent && sampleProg) {
      const appExplain = await Application.find({
        student: sampleStudent._id,
        program: sampleProg._id,
        intake: "September",
      }).explain("executionStats");

      const appStages = extractStages(appExplain.queryPlanner.winningPlan);
      const appStats = appExplain.executionStats;

      console.log(`Stages traversed: ${appStages.join(" -> ")}`);
      console.log(`Execution time: ${appStats.executionTimeMillis} ms | Docs examined: ${appStats.totalDocsExamined} | Keys examined: ${appStats.totalKeysExamined}`);
      assert(appStages.includes("IXSCAN"), "Application duplicate lookup uses IXSCAN");
      assert(!appStages.includes("COLLSCAN"), "Application duplicate check avoids COLLSCAN");
    }

    console.log("\n--- 6. Application Status & Sorting Index ---");
    const appStatusExplain = await Application.find({ status: "submitted" })
      .sort({ status: 1, createdAt: -1 })
      .explain("executionStats");

    const appStatusStages = extractStages(appStatusExplain.queryPlanner.winningPlan);
    console.log(`Stages traversed: ${appStatusStages.join(" -> ")}`);
    assert(appStatusStages.includes("IXSCAN"), "Application status query uses IXSCAN");

    console.log(`\n========================================`);
    console.log(`TOTAL EXPLAIN VERIFICATIONS: ${passed + failed}`);
    console.log(`PASSED: ${passed}`);
    console.log(`FAILED: ${failed}`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Explain verification error:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runExplainVerification();
