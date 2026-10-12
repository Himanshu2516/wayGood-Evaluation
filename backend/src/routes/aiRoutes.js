const express = require("express");
const {
  generateStudyPlan,
  getRecommendationInsights,
} = require("../controllers/aiController");
const { requireAuth, requireRole } = require("../middleware/auth");
const { aiLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

router.post(
  "/study-plan",
  aiLimiter,
  requireAuth,
  requireRole("student"),
  generateStudyPlan
);

router.post(
  "/recommendation-insights",
  aiLimiter,
  requireAuth,
  requireRole("student"),
  getRecommendationInsights
);

module.exports = router;
