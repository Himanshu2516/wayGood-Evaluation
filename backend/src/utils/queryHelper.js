function escapeRegex(text) {
  if (typeof text !== "string") return "";
  return text.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

function parseBoolean(value) {
  if (value === true || value === "true" || value === "1" || value === 1) return true;
  if (value === false || value === "false" || value === "0" || value === 0) return false;
  return undefined;
}

function parseNumber(value, fallback = undefined) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parsePagination(query, defaultLimit = 10, maxLimit = 50) {
  const pageRaw = parseNumber(query.page, 1);
  const page = Math.max(1, Math.floor(pageRaw));

  const limitRaw = parseNumber(query.limit, defaultLimit);
  const limit = Math.min(Math.max(1, Math.floor(limitRaw)), maxLimit);

  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

function buildPaginationMeta(page, limit, total) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

module.exports = {
  escapeRegex,
  parseBoolean,
  parseNumber,
  parsePagination,
  buildPaginationMeta,
};
