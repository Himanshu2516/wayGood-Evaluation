const express = require("express");

const {
  listPrograms,
  getProgramById,
} = require("../controllers/programController");

const router = express.Router();

router.get("/", listPrograms);
router.get("/:id", getProgramById);

module.exports = router;
