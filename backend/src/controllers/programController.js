const mongoose = require("mongoose");
const Program = require("../models/Program");
const cacheService = require("../services/cacheService");
const asyncHandler = require("../utils/asyncHandler");
const HttpError = require("../utils/httpError");
const {
  escapeRegex,
  parseBoolean,
  parseNumber,
  parsePagination,
  buildPaginationMeta,
} = require("../utils/queryHelper");

const listPrograms = asyncHandler(async (req, res) => {
  const sortedQuery = Object.keys(req.query || {})
    .sort()
    .map((k) => `${k}=${encodeURIComponent(req.query[k])}`)
    .join("&");
  const cacheKey = `programs:list:${sortedQuery || "default"}`;

  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return res.json({
      ...cached,
      meta: {
        ...cached.meta,
        cache: "hit",
        cacheBackend: cacheService.getType(),
      },
    });
  }

  const {
    country,
    degreeLevel,
    intake,
    field,
    q,
    minTuition,
    maxTuition,
    ielts,
    maxIelts,
    minIelts,
    scholarshipAvailable,
    stem,
    universityId,
    sortBy = "relevance",
  } = req.query;

  const filters = {};

  if (country && typeof country === "string" && country.trim()) {
    filters.country = { $regex: new RegExp(`^${escapeRegex(country)}$`, "i") };
  }

  if (degreeLevel && typeof degreeLevel === "string" && degreeLevel.trim()) {
    filters.degreeLevel = { $regex: new RegExp(`^${escapeRegex(degreeLevel)}$`, "i") };
  }

  if (field && typeof field === "string" && field.trim()) {
    filters.field = { $regex: escapeRegex(field), $options: "i" };
  }

  if (intake && typeof intake === "string" && intake.trim()) {
    filters.intakes = { $regex: new RegExp(`^${escapeRegex(intake)}$`, "i") };
  }

  if (universityId && mongoose.Types.ObjectId.isValid(universityId)) {
    filters.university = universityId;
  }

  const minTuitionVal = parseNumber(minTuition);
  const maxTuitionVal = parseNumber(maxTuition);
  if (minTuitionVal !== undefined || maxTuitionVal !== undefined) {
    filters.tuitionFeeUsd = {};
    if (minTuitionVal !== undefined && minTuitionVal >= 0) {
      filters.tuitionFeeUsd.$gte = minTuitionVal;
    }
    if (maxTuitionVal !== undefined && maxTuitionVal >= 0) {
      filters.tuitionFeeUsd.$lte = maxTuitionVal;
    }
  }

  const userIeltsScore = parseNumber(ielts !== undefined ? ielts : maxIelts);
  const programMinIelts = parseNumber(minIelts);
  if (userIeltsScore !== undefined || programMinIelts !== undefined) {
    filters.minimumIelts = {};
    if (userIeltsScore !== undefined && userIeltsScore >= 0) {
      filters.minimumIelts.$lte = userIeltsScore;
    }
    if (programMinIelts !== undefined && programMinIelts >= 0) {
      filters.minimumIelts.$gte = programMinIelts;
    }
  }

  const scholarshipFlag = parseBoolean(scholarshipAvailable);
  if (typeof scholarshipFlag === "boolean") {
    filters.scholarshipAvailable = scholarshipFlag;
  }

  const stemFlag = parseBoolean(stem);
  if (typeof stemFlag === "boolean") {
    filters.stem = stemFlag;
  }

  if (q && typeof q === "string" && q.trim()) {
    const sanitizedQ = escapeRegex(q);
    const searchRegex = { $regex: sanitizedQ, $options: "i" };
    filters.$or = [
      { title: searchRegex },
      { universityName: searchRegex },
      { field: searchRegex },
      { country: searchRegex },
      { city: searchRegex },
    ];
  }

  const { page, limit, skip } = parsePagination(req.query, 10, 50);

  const sortMap = {
    tuitionAsc: { tuitionFeeUsd: 1 },
    tuition_asc: { tuitionFeeUsd: 1 },
    tuitionDesc: { tuitionFeeUsd: -1 },
    tuition_desc: { tuitionFeeUsd: -1 },
    ieltsAsc: { minimumIelts: 1 },
    ielts_asc: { minimumIelts: 1 },
    ieltsDesc: { minimumIelts: -1 },
    ielts_desc: { minimumIelts: -1 },
    titleAsc: { title: 1 },
    title_asc: { title: 1 },
    titleDesc: { title: -1 },
    title_desc: { title: -1 },
    newest: { createdAt: -1 },
    relevance: { scholarshipAvailable: -1, tuitionFeeUsd: 1 },
  };

  const selectedSort = sortMap[sortBy] || sortMap.relevance;

  const [items, total] = await Promise.all([
    Program.find(filters)
      .select("title universityName country city field degreeLevel tuitionFeeUsd intakes durationMonths minimumIelts scholarshipAvailable stem university")
      .populate("university", "name country city qsRanking popularScore partnerType")
      .sort(selectedSort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Program.countDocuments(filters),
  ]);

  const responsePayload = {
    success: true,
    message: "Programs retrieved successfully.",
    data: items,
    meta: {
      ...buildPaginationMeta(page, limit, total),
      cache: "miss",
      cacheBackend: cacheService.getType(),
    },
  };

  await cacheService.set(cacheKey, responsePayload);

  res.json(responsePayload);
});

const getProgramById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new HttpError(400, "Invalid program ID format.");
  }

  const cacheKey = `programs:detail:${id}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return res.json({
      ...cached,
      meta: {
        cache: "hit",
        cacheBackend: cacheService.getType(),
      },
    });
  }

  const program = await Program.findById(id)
    .populate("university", "name country city qsRanking popularScore partnerType scholarshipAvailable")
    .lean();

  if (!program) {
    throw new HttpError(404, "Program not found.");
  }

  const responsePayload = {
    success: true,
    message: "Program retrieved successfully.",
    data: program,
    meta: {
      cache: "miss",
      cacheBackend: cacheService.getType(),
    },
  };

  await cacheService.set(cacheKey, responsePayload);

  res.json(responsePayload);
});

module.exports = {
  listPrograms,
  getProgramById,
};
