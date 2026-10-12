const crypto = require("crypto");
const env = require("../config/env");
const aiService = require("../services/aiService");
const cacheService = require("../services/cacheService");
const { buildProgramRecommendations } = require("../services/recommendationService");
const asyncHandler = require("../utils/asyncHandler");
const HttpError = require("../utils/httpError");

function extractAndValidateProfile(user) {
  if (!user) {
    throw new HttpError(401, "Authentication required.");
  }

  const missingFields = [];

  const preferredCountries = Array.isArray(user.preferredCountries) && user.preferredCountries.length > 0
    ? user.preferredCountries
    : (Array.isArray(user.targetCountries) && user.targetCountries.length > 0 ? user.targetCountries : []);
  if (preferredCountries.length === 0) {
    missingFields.push("preferredCountries");
  }

  const budget = Number(user.budget || user.maxBudgetUsd || 0);
  if (!budget || budget <= 0) {
    missingFields.push("budget");
  }

  const fieldOfStudy = Array.isArray(user.fieldOfStudy) && user.fieldOfStudy.length > 0
    ? user.fieldOfStudy
    : (Array.isArray(user.interestedFields) && user.interestedFields.length > 0 ? user.interestedFields : []);
  if (fieldOfStudy.length === 0) {
    missingFields.push("fieldOfStudy");
  }

  const intake = String(user.intake || user.preferredIntake || "").trim();
  if (!intake) {
    missingFields.push("intake");
  }

  const ieltsScore = Number(user.ieltsScore || user.englishTest?.score || 0);
  if (!ieltsScore || ieltsScore <= 0) {
    missingFields.push("ieltsScore");
  }

  if (missingFields.length > 0) {
    throw new HttpError(
      400,
      `Incomplete profile. Missing required fields: ${missingFields.join(", ")}.`
    );
  }

  return {
    preferredCountries,
    budget,
    fieldOfStudy,
    intake,
    ieltsScore,
  };
}

function createAiCacheKey(operation, studentId, profile, recommendations) {
  const profileFingerprint = [
    (profile.preferredCountries || []).join(","),
    profile.budget,
    (profile.fieldOfStudy || []).join(","),
    profile.intake,
    profile.ieltsScore,
  ].join("|");

  const recsFingerprint = (recommendations || [])
    .map((r) => `${r._id || r.id || r.title || ""}:${r.score || 0}`)
    .join(";");

  const hash = crypto
    .createHash("md5")
    .update(`${profileFingerprint}::${recsFingerprint}`)
    .digest("hex");

  return `ai:${operation}:${studentId}:${hash}`;
}

const generateStudyPlan = asyncHandler(async (req, res) => {
  const profile = extractAndValidateProfile(req.user);

  const recResult = await buildProgramRecommendations(req.user._id, { limit: 5 });
  const topRecommendations = (recResult.recommendations || []).slice(0, 5);

  const cacheKey = createAiCacheKey("study-plan", req.user._id, profile, topRecommendations);
  const cachedResponse = await cacheService.get(cacheKey);
  if (cachedResponse) {
    return res.status(200).json(cachedResponse);
  }

  const result = await aiService.generateStudyPlan({
    profile,
    topRecommendations,
  });

  const responsePayload = {
    success: true,
    message: "Personalized study plan generated successfully.",
    data: {
      studyPlan: result.data,
    },
    meta: result.meta,
  };

  await cacheService.set(cacheKey, responsePayload, env.cacheTtlSeconds);

  res.status(200).json(responsePayload);
});

const getRecommendationInsights = asyncHandler(async (req, res) => {
  const profile = extractAndValidateProfile(req.user);

  const recResult = await buildProgramRecommendations(req.user._id, { limit: 5 });
  const topRecommendations = (recResult.recommendations || []).slice(0, 5);

  const cacheKey = createAiCacheKey("recommendation-insights", req.user._id, profile, topRecommendations);
  const cachedResponse = await cacheService.get(cacheKey);
  if (cachedResponse) {
    return res.status(200).json(cachedResponse);
  }

  const result = await aiService.generateRecommendationInsights({
    profile,
    topRecommendations,
  });

  const responsePayload = {
    success: true,
    message: "Recommendation insights generated successfully.",
    data: {
      insights: result.data.insights,
      overallAdvice: result.data.overallAdvice,
    },
    meta: result.meta,
  };

  await cacheService.set(cacheKey, responsePayload, env.cacheTtlSeconds);

  res.status(200).json(responsePayload);
});

module.exports = {
  generateStudyPlan,
  getRecommendationInsights,
  extractAndValidateProfile,
  createAiCacheKey,
};
