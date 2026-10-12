const mongoose = require("mongoose");
const University = require("../models/University");
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

const listUniversities = asyncHandler(async (req, res) => {
  const sortedQuery = Object.keys(req.query || {})
    .sort()
    .map((k) => `${k}=${encodeURIComponent(req.query[k])}`)
    .join("&");
  const cacheKey = `universities:list:${sortedQuery || "default"}`;

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
    city,
    partnerType,
    q,
    scholarshipAvailable,
    minRanking,
    maxRanking,
    sortBy = "popular",
  } = req.query;

  const filters = {};

  if (country && typeof country === "string" && country.trim()) {
    filters.country = { $regex: new RegExp(`^${escapeRegex(country)}$`, "i") };
  }

  if (city && typeof city === "string" && city.trim()) {
    filters.city = { $regex: new RegExp(`^${escapeRegex(city)}$`, "i") };
  }

  const allowedPartnerTypes = ["direct", "recruitment-partner", "institution-partner"];
  if (partnerType && allowedPartnerTypes.includes(partnerType.trim())) {
    filters.partnerType = partnerType.trim();
  }

  const scholarshipFlag = parseBoolean(scholarshipAvailable);
  if (typeof scholarshipFlag === "boolean") {
    filters.scholarshipAvailable = scholarshipFlag;
  }

  const minRank = parseNumber(minRanking);
  const maxRank = parseNumber(maxRanking);
  if (minRank !== undefined || maxRank !== undefined) {
    filters.qsRanking = {};
    if (minRank !== undefined && minRank > 0) {
      filters.qsRanking.$gte = minRank;
    }
    if (maxRank !== undefined && maxRank > 0) {
      filters.qsRanking.$lte = maxRank;
    }
  }

  if (q && typeof q === "string" && q.trim()) {
    const sanitizedQ = escapeRegex(q);
    const searchRegex = { $regex: sanitizedQ, $options: "i" };
    filters.$or = [
      { name: searchRegex },
      { country: searchRegex },
      { city: searchRegex },
      { tags: searchRegex },
    ];
  }

  const { page, limit, skip } = parsePagination(req.query, 10, 50);

  const sortMap = {
    name: { name: 1 },
    ranking: { qsRanking: 1, popularScore: -1 },
    qsRanking: { qsRanking: 1, popularScore: -1 },
    popular: { popularScore: -1, qsRanking: 1 },
    newest: { createdAt: -1 },
  };

  const selectedSort = sortMap[sortBy] || sortMap.popular;

  const [items, total] = await Promise.all([
    University.find(filters)
      .select("name country city partnerType qsRanking popularScore scholarshipAvailable tags websiteUrl")
      .sort(selectedSort)
      .skip(skip)
      .limit(limit)
      .lean(),
    University.countDocuments(filters),
  ]);

  const responsePayload = {
    success: true,
    message: "Universities retrieved successfully.",
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

const listPopularUniversities = asyncHandler(async (req, res) => {
  const cacheKey = "universities:popular";
  const cachedPayload = await cacheService.get(cacheKey);

  if (cachedPayload) {
    return res.json({
      success: true,
      message: "Popular universities retrieved successfully.",
      data: cachedPayload,
      meta: {
        cache: "hit",
        cacheBackend: cacheService.getType(),
      },
    });
  }

  const universities = await University.find()
    .select("name country city partnerType qsRanking popularScore scholarshipAvailable tags websiteUrl")
    .sort({ popularScore: -1, qsRanking: 1 })
    .limit(6)
    .lean();

  await cacheService.set(cacheKey, universities);

  res.json({
    success: true,
    message: "Popular universities retrieved successfully.",
    data: universities,
    meta: {
      cache: "miss",
      cacheBackend: cacheService.getType(),
    },
  });
});

const getUniversityById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new HttpError(400, "Invalid university ID format.");
  }

  const cacheKey = `universities:detail:${id}`;
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

  const university = await University.findById(id).lean();

  if (!university) {
    throw new HttpError(404, "University not found.");
  }

  const programs = await Program.find({ university: university._id })
    .select("title degreeLevel tuitionFeeUsd intakes minimumIelts scholarshipAvailable stem")
    .lean();

  const responsePayload = {
    success: true,
    message: "University retrieved successfully.",
    data: {
      ...university,
      programs,
    },
    meta: {
      cache: "miss",
      cacheBackend: cacheService.getType(),
    },
  };

  await cacheService.set(cacheKey, responsePayload);

  res.json(responsePayload);
});

module.exports = {
  listPopularUniversities,
  listUniversities,
  getUniversityById,
};
