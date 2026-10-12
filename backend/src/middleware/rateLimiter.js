const rateLimit = require("express-rate-limit");
const env = require("../config/env");

const globalLimiter = rateLimit({
  windowMs: env.rateLimitGlobalWindowMs,
  max: env.rateLimitGlobalMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many requests from this IP, please try again later.",
    });
  },
});

const authLimiter = rateLimit({
  windowMs: env.rateLimitAuthWindowMs,
  max: env.rateLimitAuthMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many authentication attempts, please try again later.",
    });
  },
});

const aiLimiter = rateLimit({
  windowMs: env.rateLimitAiWindowMs,
  max: env.rateLimitAiMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many AI study plan generation requests, please try again later.",
    });
  },
});

function createRateLimiter(options = {}) {
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message: options.message || "Too many requests, please try again later.",
      });
    },
    ...options,
  });
}

module.exports = {
  globalLimiter,
  authLimiter,
  aiLimiter,
  createRateLimiter,
};
