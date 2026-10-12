const express = require("express");

const {
  login,
  me,
  getProfile,
  updateProfile,
  uploadDocument,
  deleteDocument,
  register,
} = require("../controllers/authController");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  validateRegister,
  validateLogin,
  validateUpdateProfile,
} = require("../middleware/validate");
const { authLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

router.post("/register", authLimiter, validateRegister, register);
router.post("/login", authLimiter, validateLogin, login);
router.get("/me", requireAuth, me);
router.get("/profile", requireAuth, getProfile);
router.put("/profile", requireAuth, validateUpdateProfile, updateProfile);
router.patch("/profile", requireAuth, validateUpdateProfile, updateProfile);
router.post("/documents", requireAuth, uploadDocument);
router.delete("/documents/:documentId", requireAuth, deleteDocument);

router.get("/counselor-test", requireAuth, requireRole("counselor"), (req, res) => {
  res.json({
    success: true,
    message: "Counselor access granted.",
    data: { user: req.user },
  });
});

module.exports = router;
