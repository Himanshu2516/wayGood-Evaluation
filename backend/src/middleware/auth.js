const jwt = require("jsonwebtoken");

const env = require("../config/env");
const Student = require("../models/Student");
const asyncHandler = require("../utils/asyncHandler");
const HttpError = require("../utils/httpError");

const requireAuth = asyncHandler(async (req, res, next) => {
  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
    throw new HttpError(401, "Authorization token missing or malformed.");
  }

  const token = authorizationHeader.replace("Bearer ", "").trim();

  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    const userId = decoded.sub || decoded.id;
    const student = await Student.findById(userId).select("-password");

    if (!student) {
      throw new HttpError(401, "Authenticated user no longer exists.");
    }

    req.user = student;
    next();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(401, "Invalid or expired token.");
  }
});

const optionalAuth = asyncHandler(async (req, res, next) => {
  const authorizationHeader = req.headers.authorization;

  if (authorizationHeader && authorizationHeader.startsWith("Bearer ")) {
    const token = authorizationHeader.replace("Bearer ", "").trim();
    try {
      const decoded = jwt.verify(token, env.jwtSecret);
      const userId = decoded.sub || decoded.id;
      const student = await Student.findById(userId).select("-password");
      if (student) {
        req.user = student;
      }
    } catch (error) {
    }
  }

  next();
});

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new HttpError(401, "Authentication required."));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new HttpError(
          403,
          `Forbidden: Access denied for role '${req.user.role}'. Required: ${roles.join(", ")}`
        )
      );
    }

    next();
  };
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireRole,
};
