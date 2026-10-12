const RECOMMENDATION_INSIGHTS_SYSTEM_PROMPT =
  "You explain program recommendations to a student in simple, honest language. Use ONLY the provided programs, scores and match reasons. Do not change scores or ranking. Do not invent any facts. Respond with valid JSON only.";

function buildRecommendationUserPrompt({ profile = {}, topRecommendations = [] }) {
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
    `Ranked programs with score and matchReasons: ${JSON.stringify(programsJson)}. ` +
    `Return JSON: { "insights": [ { "programTitle": "", "whyItFits": "", "watchOut": "" } ], "overallAdvice": "" }. ` +
    `One insight per program, same order as given.`
  );
}

module.exports = {
  RECOMMENDATION_INSIGHTS_SYSTEM_PROMPT,
  buildRecommendationUserPrompt,
};
