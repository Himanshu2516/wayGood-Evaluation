function errorHandler(error, req, res, next) {
  let statusCode = error.statusCode || error.status || 500;
  let message = error.message || "Something went wrong.";
  let details = error.details || undefined;

  if (error.message === "Not allowed by CORS") {
    statusCode = 403;
    message = "Origin is not allowed by CORS policy.";
  }

  if (error.type === "entity.too.large" || error.status === 413) {
    statusCode = 413;
    message = "Request payload exceeds size limit.";
  }

  if (error.code === 11000) {
    statusCode = 409;
    const field = Object.keys(error.keyPattern || {})[0] || "field";
    message = `An entry with this ${field} already exists.`;
  }

  if (error.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(error.errors)
      .map((e) => e.message)
      .join(", ");
    details = Object.keys(error.errors).map((key) => ({
      field: key,
      message: error.errors[key].message,
    }));
  }

  if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Invalid or expired authorization token.";
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(details ? { details } : {}),
  });
}

module.exports = errorHandler;
