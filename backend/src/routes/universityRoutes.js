const express = require("express");

const {
  listPopularUniversities,
  listUniversities,
  getUniversityById,
} = require("../controllers/universityController");

const router = express.Router();

router.get("/", listUniversities);
router.get("/popular", listPopularUniversities);
router.get("/:id", getUniversityById);

module.exports = router;
