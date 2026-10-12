const dotenv = require("dotenv");

dotenv.config();

module.exports = {
  cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS) || 300,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
  jwtSecret: process.env.JWT_SECRET || "dev-secret",
  mongoUri:
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/waygood-evaluation",
  port: Number(process.env.PORT) || 4000,
  redisUrl: process.env.REDIS_URL || "",
  corsWhitelist: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
    : [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
      ],
  rateLimitGlobalMax: process.env.RATE_LIMIT_GLOBAL_MAX
    ? Number(process.env.RATE_LIMIT_GLOBAL_MAX)
    : (process.env.NODE_ENV === "test" ? 10000 : 200),
  rateLimitGlobalWindowMs:
    Number(process.env.RATE_LIMIT_GLOBAL_WINDOW_MS) || 15 * 60 * 1000,
  rateLimitAuthMax: process.env.RATE_LIMIT_AUTH_MAX
    ? Number(process.env.RATE_LIMIT_AUTH_MAX)
    : (process.env.NODE_ENV === "test" ? 10000 : 20),
  rateLimitAuthWindowMs:
    Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS) || 15 * 60 * 1000,
  bodyLimit: process.env.BODY_LIMIT || "100kb",
  autoSeed: process.env.AUTO_SEED === "true" || process.env.AUTO_SEED === "1",
  forceSeed: process.env.FORCE_SEED === "true",
  groqApiKey: process.env.GROQ_API_KEY || "",
  groqModel: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
  groqFallbackModel: process.env.GROQ_FALLBACK_MODEL || "llama-3.3-70b-versatile",
  aiTimeoutMs: Number(process.env.AI_TIMEOUT_MS) || 12000,
  rateLimitAiMax: process.env.RATE_LIMIT_AI_MAX
    ? Number(process.env.RATE_LIMIT_AI_MAX)
    : (process.env.NODE_ENV === "test" ? 10000 : 30),
  rateLimitAiWindowMs:
    Number(process.env.RATE_LIMIT_AI_WINDOW_MS) || 15 * 60 * 1000,
};
