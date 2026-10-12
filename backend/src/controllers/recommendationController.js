const asyncHandler = require("../utils/asyncHandler");
const HttpError = require("../utils/httpError");
const cacheService = require("../services/cacheService");
const { buildProgramRecommendations } = require("../services/recommendationService");

const getRecommendations = asyncHandler(async (req, res) => {
  const studentId = req.params.studentId || req.query.studentId || req.user?._id;

  if (!studentId) {
    throw new HttpError(
      400,
      "studentId is required. Provide it as a route parameter /recommendations/:studentId or login to use /recommendations."
    );
  }

  const limit = req.query.limit || 5;
  const cacheKey = `recommendations:${studentId}:${limit}`;

  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return res.json({
      ...cached,
      meta: {
        ...cached.meta,
        cache: "hit",
        cacheBackend: cacheService.getType(),
      },
    });
  }

  const payload = await buildProgramRecommendations(studentId, { limit });

  const responsePayload = {
    success: true,
    message: "Recommendations generated successfully.",
    data: payload,
    meta: {
      engine: "mongodb-aggregation",
      totalRecommendations: payload.recommendations.length,
      maxPossibleScore: payload.scoringBreakdown.maxPossibleScore,
      cache: "miss",
      cacheBackend: cacheService.getType(),
    },
  };

  await cacheService.set(cacheKey, responsePayload);

  res.json(responsePayload);
});

module.exports = {
  getRecommendations,
};
