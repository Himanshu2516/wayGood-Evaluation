const env = require("../config/env");
const logger = require("../utils/logger");
const {
  STUDY_PLAN_SYSTEM_PROMPT,
  buildStudyPlanUserPrompt,
} = require("../prompts/studyPlanPrompt");
const {
  RECOMMENDATION_INSIGHTS_SYSTEM_PROMPT,
  buildRecommendationUserPrompt,
} = require("../prompts/recommendationPrompt");

function validateStudyPlan(parsed, topRecommendations = []) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Study plan must be a valid JSON object");
  }

  if (typeof parsed.summary !== "string" || !parsed.summary.trim()) {
    throw new Error("Missing or invalid 'summary' string");
  }

  if (!Array.isArray(parsed.shortlist)) {
    throw new Error("Missing or invalid 'shortlist' array");
  }

  const availableCount = topRecommendations.length;
  const minExpected = Math.min(3, availableCount);
  if (parsed.shortlist.length < minExpected || parsed.shortlist.length > 5) {
    throw new Error(
      `Shortlist count (${parsed.shortlist.length}) must be between ${minExpected} and 5`
    );
  }

  const allowedTitles = topRecommendations.map((r) => {
    const prog = r.program || r;
    return (prog.title || "").toLowerCase().trim();
  });

  for (const item of parsed.shortlist) {
    if (!item || typeof item !== "object") {
      throw new Error("Shortlist items must be objects");
    }
    const itemTitle = (item.programTitle || "").toLowerCase().trim();
    if (!itemTitle || !allowedTitles.includes(itemTitle)) {
      throw new Error(
        `Referenced program '${item.programTitle}' is not in the supplied recommendation list`
      );
    }
    if (typeof item.university !== "string") {
      throw new Error("Shortlist item missing 'university'");
    }
    if (typeof item.reason !== "string") {
      throw new Error("Shortlist item missing 'reason'");
    }
    if (typeof item.risk !== "string") {
      throw new Error("Shortlist item missing 'risk'");
    }
    item.tuitionFeeUsd = Number(item.tuitionFeeUsd) || 0;
    item.ieltsGap = Number(item.ieltsGap) || 0;
    item.universityName = item.university;
  }

  if (!Array.isArray(parsed.timeline) || parsed.timeline.length === 0) {
    throw new Error("Missing or invalid 'timeline' array");
  }
  for (const item of parsed.timeline) {
    if (!item || typeof item.month !== "string" || typeof item.task !== "string") {
      throw new Error("Timeline item must have 'month' and 'task' strings");
    }
  }

  if (!Array.isArray(parsed.documentsChecklist) || parsed.documentsChecklist.length === 0) {
    throw new Error("Missing or invalid 'documentsChecklist' array");
  }

  if (typeof parsed.budgetNotes !== "string" || !parsed.budgetNotes.trim()) {
    throw new Error("Missing or invalid 'budgetNotes' string");
  }

  if (!Array.isArray(parsed.nextSteps) || parsed.nextSteps.length === 0) {
    throw new Error("Missing or invalid 'nextSteps' array");
  }

  return true;
}

function validateRecommendationInsights(parsed, topRecommendations = []) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Recommendation insights must be a valid JSON object");
  }

  if (!Array.isArray(parsed.insights)) {
    throw new Error("Missing or invalid 'insights' array");
  }

  if (typeof parsed.overallAdvice !== "string" || !parsed.overallAdvice.trim()) {
    throw new Error("Missing or invalid 'overallAdvice' string");
  }

  const allowedTitles = topRecommendations.map((r) => {
    const prog = r.program || r;
    return (prog.title || "").toLowerCase().trim();
  });

  for (const item of parsed.insights) {
    if (!item || typeof item !== "object") {
      throw new Error("Insight item must be an object");
    }
    const itemTitle = (item.programTitle || "").toLowerCase().trim();
    if (!itemTitle || !allowedTitles.includes(itemTitle)) {
      throw new Error(
        `Referenced insight program '${item.programTitle}' is not in the supplied recommendation list`
      );
    }
    if (typeof item.whyItFits !== "string") {
      throw new Error("Insight item missing 'whyItFits'");
    }
    if (typeof item.watchOut !== "string") {
      throw new Error("Insight item missing 'watchOut'");
    }
    if (!item.watchOut.trim()) {
      item.watchOut = "Verify international application deadlines and course registration with the university.";
    }
  }

  return true;
}

function generateRuleBasedPlan({ profile = {}, topRecommendations = [] }) {
  const budget = Number(profile.budget || profile.maxBudgetUsd || 0) || 30000;
  const preferredCountries = Array.isArray(profile.preferredCountries) && profile.preferredCountries.length > 0
    ? profile.preferredCountries
    : profile.targetCountries || ["United Kingdom", "United States", "Canada"];
  const fieldOfStudy = Array.isArray(profile.fieldOfStudy) && profile.fieldOfStudy.length > 0
    ? profile.fieldOfStudy.join(" / ")
    : "Computer Science";
  const intake = profile.intake || profile.preferredIntake || "Fall 2025";
  const studentIelts = Number(profile.ieltsScore || profile.englishTest?.score || 0) || 6.5;

  const count = Math.min(Math.max(topRecommendations.length, 1), 5);
  const shortlist = topRecommendations.slice(0, count).map((rec) => {
    const prog = rec.program || rec;
    const title = prog.title || `${fieldOfStudy} Degree`;
    const university = prog.university?.name || prog.universityName || "Partner University";
    const tuition = Number(prog.tuitionFeeUsd) || 25000;
    const minIelts = Number(prog.minimumIelts) || 6.5;
    const ieltsGap = Math.round((studentIelts - minIelts) * 10) / 10;

    let reason = rec.matchReasons?.length
      ? rec.matchReasons.join(". ")
      : `Matches academic alignment for ${fieldOfStudy} in ${prog.country || preferredCountries[0]}.`;

    let risk = "Low admission risk; credentials meet verified requirements.";
    if (tuition > budget) {
      risk = `Tuition fee ($${tuition.toLocaleString()}) exceeds budget ($${budget.toLocaleString()}); verify scholarship eligibility.`;
    } else if (ieltsGap < 0) {
      risk = `Current IELTS score is ${Math.abs(ieltsGap)} band(s) below requirement (${minIelts}); retake or pre-sessional required.`;
    }

    return {
      programTitle: title,
      university,
      universityName: university,
      reason,
      risk,
      tuitionFeeUsd: tuition,
      ieltsGap,
    };
  });

  const timeline = [
    {
      month: "Month 1 - 2",
      task: `Finalize transcript requests, schedule IELTS retake if closing band gap (current: ${studentIelts}), and confirm course prerequisites.`,
    },
    {
      month: "Month 3 - 4",
      task: `Draft Statement of Purpose tailored to ${fieldOfStudy}, secure 2 academic letters of recommendation, and update CV.`,
    },
    {
      month: "Month 5",
      task: `Submit prioritized applications for ${intake} intake before international scholarship priority deadlines.`,
    },
    {
      month: "Month 6 - 7",
      task: "Evaluate admissions offers, accept preferred program offer, pay tuition deposit, and obtain CAS/I-20 documentation.",
    },
    {
      month: "Month 8",
      task: "Gather bank solvency certificates, complete student visa application, book accommodation, and attend pre-departure briefing.",
    },
  ];

  const documentsChecklist = [
    "Official Academic Transcripts (All Semesters)",
    "Degree Certificate or Provisional Convocation Certificate",
    `Official IELTS Score Card (Verified score: ${studentIelts})`,
    "Statement of Purpose (SOP) tailored to target programs",
    "2-3 Academic and Professional Letters of Recommendation (LOR)",
    "Updated Academic Curriculum Vitae (CV)",
    `Bank Solvency Statement demonstrating tuition ($${budget.toLocaleString()}) plus living support`,
    "Valid International Passport with at least 6 months validity",
  ];

  const avgTuition = shortlist.length > 0
    ? Math.round(shortlist.reduce((acc, p) => acc + p.tuitionFeeUsd, 0) / shortlist.length)
    : budget;

  const budgetNotes = `Your stated tuition budget is $${budget.toLocaleString()} USD. Shortlisted programs average $${avgTuition.toLocaleString()} USD in annual tuition. Estimated living expenses typically range from $10,000 to $14,000 USD per academic year depending on destination country. Verify institutional merit scholarships directly with each university.`;

  const nextSteps = [
    "Confirm program shortlist with your assigned counselor",
    "Request official transcripts and degree certificates from current institution",
    "Draft tailored statements of purpose for shortlisted universities",
    "Verify deadline dates directly with admissions portals",
  ];

  return {
    summary: `Strategic application roadmap for ${fieldOfStudy} targeting ${intake} intake across ${preferredCountries.join(", ")}. Grounded exclusively on verified programs with matched tuition and intake schedules.`,
    shortlist,
    timeline,
    documentsChecklist,
    budgetNotes,
    nextSteps,
  };
}

function generateRuleBasedInsights({ profile = {}, topRecommendations = [] }) {
  const budget = Number(profile.budget || profile.maxBudgetUsd || 0) || 30000;
  const studentIelts = Number(profile.ieltsScore || profile.englishTest?.score || 0) || 6.5;

  const insights = topRecommendations.slice(0, 5).map((rec) => {
    const prog = rec.program || rec;
    const title = prog.title || "Academic Program";
    const tuition = Number(prog.tuitionFeeUsd) || 0;
    const minIelts = Number(prog.minimumIelts) || 0;

    const whyItFits = rec.matchReasons?.length
      ? rec.matchReasons.join("; ")
      : `High ranking match in ${prog.country || "selected destination"} with verified intake alignment.`;

    let watchOut = "Verify application deadlines and visa processing lead times early.";
    if (tuition > budget) {
      watchOut = `Tuition ($${tuition.toLocaleString()}) exceeds your budget ($${budget.toLocaleString()}). Early scholarship application recommended.`;
    } else if (minIelts > studentIelts) {
      watchOut = `Minimum required IELTS is ${minIelts}, which is higher than your current score (${studentIelts}).`;
    }

    return {
      programTitle: title,
      whyItFits,
      watchOut,
    };
  });

  const overallAdvice = `Your recommendations show strong destination and academic alignment. Focus on programs where your IELTS score meets the requirement, and prepare scholarship applications for programs that stretch your target tuition budget.`;

  return {
    insights,
    overallAdvice,
  };
}

async function callGroqChat({
  apiKey,
  model,
  systemPrompt,
  userPrompt,
  timeoutMs,
}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const isGptOss = model.toLowerCase().includes("gpt-oss");
  const payload = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  };

  if (isGptOss) {
    payload.reasoning_effort = "low";
    payload.max_completion_tokens = 1500;
  } else {
    payload.max_tokens = 1500;
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function executeGroqWithFallback({
  systemPrompt,
  userPrompt,
  profile,
  topRecommendations,
  validator,
  fallbackGenerator,
}) {
  const apiKey = env.groqApiKey;

  if (!apiKey || !apiKey.trim()) {
    logger.info("GROQ_API_KEY is not configured. Using rule-based fallback.");
    return {
      data: fallbackGenerator({ profile, topRecommendations }),
      meta: {
        source: "fallback",
        model: null,
      },
    };
  }

  const primaryModel = env.groqModel || "openai/gpt-oss-120b";
  const backupModel = env.groqFallbackModel || "llama-3.3-70b-versatile";
  const timeoutMs = env.aiTimeoutMs;

  const tryParseAndValidate = (jsonText) => {
    const cleaned = jsonText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    validator(parsed, topRecommendations);
    return parsed;
  };

  const invokeModelWithRetry = async (modelName) => {
    let response = await callGroqChat({
      apiKey,
      model: modelName,
      systemPrompt,
      userPrompt,
      timeoutMs,
    });

    if (response.status === 429) {
      const retryHeader = response.headers.get("retry-after") || response.headers.get("Retry-After");
      const retrySec = parseInt(retryHeader, 10);
      const waitMs = Math.min(!isNaN(retrySec) && retrySec > 0 ? retrySec * 1000 : 1000, 2000);
      logger.warn(`Groq 429 on model ${modelName}. Waiting ${waitMs}ms before retry...`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));

      response = await callGroqChat({
        apiKey,
        model: modelName,
        systemPrompt,
        userPrompt,
        timeoutMs,
      });
    }

    if (!response.ok) {
      throw new Error(`Groq model ${modelName} returned HTTP ${response.status}`);
    }

    const json = await response.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error(`Groq model ${modelName} returned empty response content`);
    }

    return tryParseAndValidate(content);
  };

  try {
    const parsedData = await invokeModelWithRetry(primaryModel);
    return {
      data: parsedData,
      meta: {
        source: "groq",
        model: primaryModel,
      },
    };
  } catch (primaryErr) {
    logger.warn(`Primary Groq model (${primaryModel}) failed: ${primaryErr.message}. Switching to backup model (${backupModel}).`);
  }

  try {
    const parsedBackup = await invokeModelWithRetry(backupModel);
    return {
      data: parsedBackup,
      meta: {
        source: "groq-backup",
        model: backupModel,
      },
    };
  } catch (backupErr) {
    logger.warn(`Backup Groq model (${backupModel}) failed: ${backupErr.message}. Switching to rule-based fallback.`);
  }

  return {
    data: fallbackGenerator({ profile, topRecommendations }),
    meta: {
      source: "fallback",
      model: null,
    },
  };
}

async function generateStudyPlan({ profile = {}, topRecommendations = [] }) {
  const userPrompt = buildStudyPlanUserPrompt({ profile, topRecommendations });
  return executeGroqWithFallback({
    systemPrompt: STUDY_PLAN_SYSTEM_PROMPT,
    userPrompt,
    profile,
    topRecommendations,
    validator: validateStudyPlan,
    fallbackGenerator: generateRuleBasedPlan,
  });
}

async function generateRecommendationInsights({ profile = {}, topRecommendations = [] }) {
  const userPrompt = buildRecommendationUserPrompt({ profile, topRecommendations });
  return executeGroqWithFallback({
    systemPrompt: RECOMMENDATION_INSIGHTS_SYSTEM_PROMPT,
    userPrompt,
    profile,
    topRecommendations,
    validator: validateRecommendationInsights,
    fallbackGenerator: generateRuleBasedInsights,
  });
}

module.exports = {
  generateStudyPlan,
  generateRecommendationInsights,
  generateRuleBasedPlan,
  generateRuleBasedInsights,
  validateStudyPlan,
  validateRecommendationInsights,
};
