const express = require("express");

const {
  createApplication,
  listApplications,
  getApplicationById,
  updateApplicationStatus,
  withdrawApplication,
} = require("../controllers/applicationController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.get("/", listApplications);
router.get("/:id", getApplicationById);
router.post("/", createApplication);
router.patch("/:id/status", updateApplicationStatus);
router.patch("/:id/withdraw", withdrawApplication);
router.post("/:id/withdraw", withdrawApplication);

module.exports = router;
