const STUDY_PLAN_SYSTEM_PROMPT =
  "You are an experienced study-abroad counselor. You help one student plan their application journey using ONLY the programs provided in the user message. Rules: (1) Never invent universities, programs, tuition fees, deadlines, scholarships or visa rules. Use only the data provided. If something is unknown, write 'verify with the university'. (2) All money is in USD, as provided. (3) Be specific and practical. (4) Respond with valid JSON only, no markdown, no text outside the JSON, matching exactly the schema given.";

function buildStudyPlanUserPrompt({ profile = {}, topRecommendations = [] }) {
  const preferredCountries = Array.isArray(profile.preferredCountries)
    ? profile.preferredCountries
    : profile.targetCountries || [];

  const fieldOfStudy = Array.isArray(profile.fieldOfStudy)
    ? profile.fieldOfStudy
    : profile.interestedFields || [];

  const studentProfile = {
    preferredCountries,
    budgetUsd: Number(profile.budget || profile.maxBudgetUsd || 0),
    fieldOfStudy,
    intake: profile.intake || profile.preferredIntake || "",
    ieltsScore: Number(profile.ieltsScore || profile.englishTest?.score || 0),
  };

  const programsJson = (topRecommendations || []).slice(0, 5).map((rec) => {
    const prog = rec.program || rec;
    return {
      programTitle: prog.title || "",
      university: prog.university?.name || prog.universityName || "",
      country: prog.country || "",
      tuitionFeeUsd: Number(prog.tuitionFeeUsd) || 0,
      minimumIelts: Number(prog.minimumIelts) || 0,
      intakes: prog.intakes || [],
      score: rec.score !== undefined ? rec.score : undefined,
      matchReasons: rec.matchReasons || [],
    };
  });

  return (
    `Student profile: ${JSON.stringify(studentProfile)}. ` +
    `Top programs (JSON): ${JSON.stringify(programsJson)}. ` +
    `Create a study plan with this exact JSON shape:\n` +
    `{\n` +
    `  "summary": "2-3 sentence overview",\n` +
    `  "shortlist": [ { "programTitle": "", "university": "", "reason": "", "risk": "", "tuitionFeeUsd": 0, "ieltsGap": 0 } ],\n` +
    `  "timeline": [ { "month": "", "task": "" } ],\n` +
    `  "documentsChecklist": [ "" ],\n` +
    `  "budgetNotes": "",\n` +
    `  "nextSteps": [ "" ]\n` +
    `}\n` +
    `Rules: shortlist must contain 3 to 5 programs taken only from the list above. ieltsGap is student ielts minus program minimumIelts (negative means the student is short). Timeline must work backwards from the chosen intake and be realistic. Do not mention any program that is not in the list.`
  );
}

module.exports = {
  STUDY_PLAN_SYSTEM_PROMPT,
  buildStudyPlanUserPrompt,
};
