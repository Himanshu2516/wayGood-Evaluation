const express = require("express");

const { getRecommendations } = require("../controllers/recommendationController");
const { optionalAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", optionalAuth, getRecommendations);
router.get("/:studentId", optionalAuth, getRecommendations);

module.exports = router;
