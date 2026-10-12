const connectDatabase = require("../config/database");
const app = require("../app");
const mongoose = require("mongoose");
const http = require("http");

async function runTests() {
  console.log("=== PHASE 2 DISCOVERY APIS VERIFICATION SUITE ===");

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
    console.log("--- 1. Testing University Discovery Endpoints ---");

    const uniListRes = await fetch(`${baseUrl}/universities?page=1&limit=3`);
    const uniList = await uniListRes.json();
    assert(uniListRes.status === 200, "GET /universities returns HTTP 200");
    assert(uniList.success === true, "University listing success === true");
    assert(uniList.message === "Universities retrieved successfully.", "Response message matches");
    assert(Array.isArray(uniList.data), "University listing returns data array");
    assert(uniList.data.length === 3, "Pagination limit respected (3 items returned)");
    assert(uniList.meta?.page === 1, "Meta page === 1");
    assert(uniList.meta?.limit === 3, "Meta limit === 3");
    assert(uniList.meta?.total > 3, "Meta total count is accurate");
    assert(uniList.meta?.hasNextPage === true, "Meta hasNextPage === true");
    assert(uniList.meta?.hasPrevPage === false, "Meta hasPrevPage === false");

    const sampleUniId = uniList.data[0]._id;

    const uniCountryRes = await fetch(`${baseUrl}/universities?country=Canada`);
    const uniCountry = await uniCountryRes.json();
    assert(uniCountryRes.status === 200, "GET /universities?country=Canada HTTP 200");
    assert(uniCountry.data.length > 0, "Found Canadian universities");
    const allCanada = uniCountry.data.every((u) => u.country.toLowerCase() === "canada");
    assert(allCanada, "All returned universities are in Canada");

    const uniPartnerRes = await fetch(`${baseUrl}/universities?partnerType=direct`);
    const uniPartner = await uniPartnerRes.json();
    assert(uniPartner.data.every((u) => u.partnerType === "direct"), "Filter by partnerType=direct works");

    const uniScholarRes = await fetch(`${baseUrl}/universities?scholarshipAvailable=true`);
    const uniScholar = await uniScholarRes.json();
    assert(uniScholar.data.every((u) => u.scholarshipAvailable === true), "Filter scholarshipAvailable=true works");

    const uniRankRes = await fetch(`${baseUrl}/universities?maxRanking=100`);
    const uniRank = await uniRankRes.json();
    assert(uniRank.data.every((u) => u.qsRanking <= 100), "Filter maxRanking=100 works");

    const uniSearchRes = await fetch(`${baseUrl}/universities?q=Windsor`);
    const uniSearch = await uniSearchRes.json();
    assert(uniSearch.data.length > 0, "Search for 'Windsor' returns results");
    assert(
      uniSearch.data.some((u) => u.name.includes("Windsor") || u.city.includes("Windsor")),
      "Results match search term 'Windsor'"
    );

    const uniSanitizeRes = await fetch(`${baseUrl}/universities?q=Tor.*[0-9]+(?=onto)`);
    const uniSanitize = await uniSanitizeRes.json();
    assert(uniSanitizeRes.status === 200, "Search with regex characters does not crash (sanitized)");
    assert(uniSanitize.success === true, "Sanitized search returns safe response");

    const uniSortRankRes = await fetch(`${baseUrl}/universities?sortBy=ranking&limit=5`);
    const uniSortRank = await uniSortRankRes.json();
    let ranksOrdered = true;
    for (let i = 1; i < uniSortRank.data.length; i++) {
      if (uniSortRank.data[i].qsRanking < uniSortRank.data[i - 1].qsRanking) {
        ranksOrdered = false;
        break;
      }
    }
    assert(ranksOrdered, "Sorting by ranking ascending works");

    const uniSortNameRes = await fetch(`${baseUrl}/universities?sortBy=name&limit=5`);
    const uniSortName = await uniSortNameRes.json();
    let namesOrdered = true;
    for (let i = 1; i < uniSortName.data.length; i++) {
      if (uniSortName.data[i].name.localeCompare(uniSortName.data[i - 1].name) < 0) {
        namesOrdered = false;
        break;
      }
    }
    assert(namesOrdered, "Sorting by name alphabetical works");

    const uniPop1Res = await fetch(`${baseUrl}/universities/popular`);
    const uniPop1 = await uniPop1Res.json();
    assert(uniPop1Res.status === 200, "GET /universities/popular HTTP 200");
    assert(uniPop1.meta?.cache === "miss" || uniPop1.meta?.cache === "hit", "Popular response has cache metadata");

    const uniPop2Res = await fetch(`${baseUrl}/universities/popular`);
    const uniPop2 = await uniPop2Res.json();
    assert(uniPop2.meta?.cache === "hit", "Second request hits cache (cache: hit)");

    const uniDetailRes = await fetch(`${baseUrl}/universities/${sampleUniId}`);
    const uniDetail = await uniDetailRes.json();
    assert(uniDetailRes.status === 200, "GET /universities/:id HTTP 200");
    assert(uniDetail.data?._id === sampleUniId, "Returned university ID matches");
    assert(Array.isArray(uniDetail.data?.programs), "University detail includes associated programs list");

    const uniBadIdRes = await fetch(`${baseUrl}/universities/invalid-id-format`);
    assert(uniBadIdRes.status === 400, "Invalid university ID format HTTP 400");

    const fakeUniId = new mongoose.Types.ObjectId().toString();
    const uniNotFoundRes = await fetch(`${baseUrl}/universities/${fakeUniId}`);
    assert(uniNotFoundRes.status === 404, "Non-existent university ID HTTP 404");

    console.log("\n--- 2. Testing Program Discovery Endpoints ---");

    const progListRes = await fetch(`${baseUrl}/programs?page=1&limit=4`);
    const progList = await progListRes.json();
    assert(progListRes.status === 200, "GET /programs returns HTTP 200");
    assert(progList.success === true, "Program listing success === true");
    assert(progList.message === "Programs retrieved successfully.", "Response message matches");
    assert(Array.isArray(progList.data), "Program listing returns data array");
    assert(progList.data.length === 4, "Pagination limit respected (4 items returned)");
    assert(Boolean(progList.data[0].university?.name), "Program populates university reference");
    assert(progList.meta?.page === 1, "Meta page === 1");
    assert(progList.meta?.limit === 4, "Meta limit === 4");
    assert(progList.meta?.total > 4, "Meta total count is accurate");
    assert(progList.meta?.hasNextPage === true, "Meta hasNextPage === true");

    const sampleProgId = progList.data[0]._id;

    const progCountryRes = await fetch(`${baseUrl}/programs?country=UK`);
    const progCountry = await progCountryRes.json();
    assert(progCountryRes.status === 200, "GET /programs?country=UK HTTP 200");
    assert(progCountry.data.length > 0, "Found UK programs");
    assert(progCountry.data.every((p) => p.country.toLowerCase() === "uk"), "All returned programs are in UK");

    const progFieldRes = await fetch(`${baseUrl}/programs?field=Computer`);
    const progField = await progFieldRes.json();
    assert(progField.data.length > 0, "Found programs in Computer field");
    assert(
      progField.data.every((p) => p.field.toLowerCase().includes("computer")),
      "All programs match field 'Computer'"
    );

    const progIntakeRes = await fetch(`${baseUrl}/programs?intake=September`);
    const progIntake = await progIntakeRes.json();
    assert(progIntake.data.length > 0, "Found September intake programs");
    assert(
      progIntake.data.every((p) => p.intakes.some((i) => i.toLowerCase() === "september")),
      "All programs include September intake"
    );

    const progDegreeRes = await fetch(`${baseUrl}/programs?degreeLevel=master`);
    const progDegree = await progDegreeRes.json();
    assert(progDegree.data.length > 0, "Found master programs");
    assert(progDegree.data.every((p) => p.degreeLevel === "master"), "All programs have degreeLevel 'master'");

    const progMaxTuitionRes = await fetch(`${baseUrl}/programs?maxTuition=20000`);
    const progMaxTuition = await progMaxTuitionRes.json();
    assert(progMaxTuition.data.length > 0, "Found programs with tuition <= 20000");
    assert(
      progMaxTuition.data.every((p) => p.tuitionFeeUsd <= 20000),
      "All programs have tuitionFeeUsd <= 20000"
    );

    const progRangeTuitionRes = await fetch(`${baseUrl}/programs?minTuition=18000&maxTuition=25000`);
    const progRangeTuition = await progRangeTuitionRes.json();
    assert(
      progRangeTuition.data.every((p) => p.tuitionFeeUsd >= 18000 && p.tuitionFeeUsd <= 25000),
      "All programs tuition between 18000 and 25000"
    );

    const progIeltsRes = await fetch(`${baseUrl}/programs?ielts=6.5`);
    const progIelts = await progIeltsRes.json();
    assert(progIelts.data.length > 0, "Found programs accessible with IELTS 6.5");
    assert(
      progIelts.data.every((p) => p.minimumIelts <= 6.5),
      "All programs have minimumIelts <= 6.5"
    );

    const progScholarRes = await fetch(`${baseUrl}/programs?scholarshipAvailable=true`);
    const progScholar = await progScholarRes.json();
    assert(
      progScholar.data.every((p) => p.scholarshipAvailable === true),
      "All programs have scholarshipAvailable === true"
    );

    const progStemRes = await fetch(`${baseUrl}/programs?stem=true`);
    const progStem = await progStemRes.json();
    assert(progStem.data.every((p) => p.stem === true), "All programs have stem === true");

    const progSearchRes = await fetch(`${baseUrl}/programs?q=Data%20Science`);
    const progSearch = await progSearchRes.json();
    assert(progSearch.data.length > 0, "Search for 'Data Science' returns results");
    assert(
      progSearch.data.some((p) => p.title.includes("Data") || p.field.includes("Data")),
      "Programs match search term 'Data Science'"
    );

    const progSanitizeRes = await fetch(`${baseUrl}/programs?q=C++%20[a-z]+.*`);
    const progSanitize = await progSanitizeRes.json();
    assert(progSanitizeRes.status === 200, "Search with special regex characters handles cleanly");
    assert(progSanitize.success === true, "Sanitized search success === true");

    const progSortAscRes = await fetch(`${baseUrl}/programs?sortBy=tuitionAsc&limit=5`);
    const progSortAsc = await progSortAscRes.json();
    let tuitionAscOrdered = true;
    for (let i = 1; i < progSortAsc.data.length; i++) {
      if (progSortAsc.data[i].tuitionFeeUsd < progSortAsc.data[i - 1].tuitionFeeUsd) {
        tuitionAscOrdered = false;
        break;
      }
    }
    assert(tuitionAscOrdered, "Sorting by tuition ascending works");

    const progSortDescRes = await fetch(`${baseUrl}/programs?sortBy=tuitionDesc&limit=5`);
    const progSortDesc = await progSortDescRes.json();
    let tuitionDescOrdered = true;
    for (let i = 1; i < progSortDesc.data.length; i++) {
      if (progSortDesc.data[i].tuitionFeeUsd > progSortDesc.data[i - 1].tuitionFeeUsd) {
        tuitionDescOrdered = false;
        break;
      }
    }
    assert(tuitionDescOrdered, "Sorting by tuition descending works");

    const progDetailRes = await fetch(`${baseUrl}/programs/${sampleProgId}`);
    const progDetail = await progDetailRes.json();
    assert(progDetailRes.status === 200, "GET /programs/:id HTTP 200");
    assert(progDetail.data?._id === sampleProgId, "Returned program ID matches");
    assert(Boolean(progDetail.data?.university?.name), "Program detail includes populated university info");

    const progBadIdRes = await fetch(`${baseUrl}/programs/not-an-object-id`);
    assert(progBadIdRes.status === 400, "Invalid program ID format HTTP 400");

    const fakeProgId = new mongoose.Types.ObjectId().toString();
    const progNotFoundRes = await fetch(`${baseUrl}/programs/${fakeProgId}`);
    assert(progNotFoundRes.status === 404, "Non-existent program ID HTTP 404");

    console.log(`\n========================================`);
    console.log(`TOTAL PHASE 2 TESTS: ${passed + failed}`);
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
