const morgan = require("morgan");

const structuredHttpLogger = morgan((tokens, req, res) => {
  return JSON.stringify({
    type: "http_access",
    timestamp: tokens.date(req, res, "iso") || new Date().toISOString(),
    method: tokens.method(req, res),
    url: tokens.url(req, res),
    status: Number(tokens.status(req, res)) || null,
    responseTimeMs: Number(tokens["response-time"](req, res)) || 0,
    contentLength: Number(tokens.res(req, res, "content-length")) || 0,
    remoteAddr: tokens["remote-addr"](req, res) || req.ip || null,
    userAgent: req.headers["user-agent"] || null,
  });
}, {
  skip: () => process.env.NODE_ENV === "test" && process.env.ENABLE_TEST_LOGS !== "true",
});

function formatLog(level, message, meta = {}) {
  return JSON.stringify({
    level,
    timestamp: new Date().toISOString(),
    message,
    ...meta,
  });
}

const logger = {
  http: structuredHttpLogger,
  info: (message, meta) => {
    if (process.env.NODE_ENV !== "test" || process.env.ENABLE_TEST_LOGS === "true") {
      console.log(formatLog("info", message, meta));
    }
  },
  warn: (message, meta) => {
    if (process.env.NODE_ENV !== "test" || process.env.ENABLE_TEST_LOGS === "true") {
      console.warn(formatLog("warn", message, meta));
    }
  },
  error: (message, meta) => {
    if (process.env.NODE_ENV !== "test" || process.env.ENABLE_TEST_LOGS === "true") {
      console.error(formatLog("error", message, meta));
    }
  },
};

module.exports = logger;
