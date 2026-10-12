const HttpError = require("../utils/httpError");

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRegister(req, res, next) {
  const { fullName, email, password, role, preferredCountries, budget, fieldOfStudy, intake, ieltsScore } = req.body;
  const errors = [];

  if (!fullName || typeof fullName !== "string" || fullName.trim().length < 2) {
    errors.push("fullName is required and must be at least 2 characters long.");
  }

  if (!email || typeof email !== "string" || !emailRegex.test(email.trim())) {
    errors.push("A valid email address is required.");
  }

  if (!password || typeof password !== "string" || password.length < 8) {
    errors.push("password is required and must be at least 8 characters long.");
  }

  if (role && !["student", "counselor", "admin"].includes(role)) {
    errors.push("role must be 'student', 'counselor', or 'admin'.");
  }

  if (preferredCountries !== undefined && !Array.isArray(preferredCountries)) {
    errors.push("preferredCountries must be an array of country names.");
  }

  if (budget !== undefined && (typeof budget !== "number" || budget < 0)) {
    errors.push("budget must be a positive number.");
  }

  if (ieltsScore !== undefined && (typeof ieltsScore !== "number" || ieltsScore < 0 || ieltsScore > 9)) {
    errors.push("ieltsScore must be a number between 0 and 9.");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation failed: " + errors.join(" "),
      details: errors,
    });
  }

  next();
}

function validateLogin(req, res, next) {
  const { email, password } = req.body;
  const errors = [];

  if (!email || typeof email !== "string" || !emailRegex.test(email.trim())) {
    errors.push("A valid email address is required.");
  }

  if (!password || typeof password !== "string" || password.length === 0) {
    errors.push("password is required.");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation failed: " + errors.join(" "),
      details: errors,
    });
  }

  next();
}

function validateUpdateProfile(req, res, next) {
  const { fullName, preferredCountries, budget, fieldOfStudy, intake, ieltsScore, role } = req.body;
  const errors = [];

  if (fullName !== undefined && (typeof fullName !== "string" || fullName.trim().length < 2)) {
    errors.push("fullName must be at least 2 characters long.");
  }

  if (preferredCountries !== undefined && !Array.isArray(preferredCountries)) {
    errors.push("preferredCountries must be an array of country names.");
  }

  if (budget !== undefined && (typeof budget !== "number" || budget < 0)) {
    errors.push("budget must be a positive number.");
  }

  if (ieltsScore !== undefined && (typeof ieltsScore !== "number" || ieltsScore < 0 || ieltsScore > 9)) {
    errors.push("ieltsScore must be a number between 0 and 9.");
  }

  if (role !== undefined && !["student", "counselor", "admin"].includes(role)) {
    errors.push("role must be 'student', 'counselor', or 'admin'.");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation failed: " + errors.join(" "),
      details: errors,
    });
  }

  next();
}

module.exports = {
  validateRegister,
  validateLogin,
  validateUpdateProfile,
};
