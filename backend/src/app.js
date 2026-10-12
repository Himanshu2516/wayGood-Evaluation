const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");

const env = require("./config/env");
const { globalLimiter } = require("./middleware/rateLimiter");
const logger = require("./utils/logger");

const aiRoutes = require("./routes/aiRoutes");
const applicationRoutes = require("./routes/applicationRoutes");
const authRoutes = require("./routes/authRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const healthRoutes = require("./routes/healthRoutes");
const programRoutes = require("./routes/programRoutes");
const recommendationRoutes = require("./routes/recommendationRoutes");
const universityRoutes = require("./routes/universityRoutes");
const errorHandler = require("./middleware/errorHandler");
const notFound = require("./middleware/notFound");

const app = express();

app.set("trust proxy", 1);

app.use(helmet());

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || env.corsWhitelist.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
};
app.use(cors(corsOptions));

app.use(express.json({ limit: env.bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: env.bodyLimit }));

app.use(mongoSanitize());

app.use(logger.http);

app.use("/api", globalLimiter);

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/universities", universityRoutes);
app.use("/api/programs", programRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
