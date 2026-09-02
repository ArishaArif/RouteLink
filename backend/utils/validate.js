const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const INTEGER_PATTERN = /^\d+$/;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MAX_TRIP_DAYS = 60;

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function unknownKeys(body, allowedFields) {
  if (!isPlainObject(body)) {
    return [];
  }
  return Object.keys(body).filter((key) => !allowedFields.includes(key));
}

function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function isValidCalendarDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isFiniteNumber(value) {
  return typeof value === 'number' ? Number.isFinite(value) : isNonEmptyString(value) && Number.isFinite(Number(value));
}

function isInRange(value, min, max) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= min && numeric <= max;
}

function dayCountInclusive(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  return Math.round((end - start) / 86400000) + 1;
}

function requireUuidParam(req, res, paramName, label) {
  const value = req.params[paramName];
  if (!isUuid(value)) {
    res.status(400).json({ error: `${label} must be a valid UUID` });
    return null;
  }
  return value;
}

function parsePagination(req, res) {
  const { limit, offset } = req.query;
  const details = [];
  let parsedLimit = DEFAULT_LIMIT;
  let parsedOffset = 0;

  if (limit !== undefined) {
    if (!INTEGER_PATTERN.test(String(limit))) {
      details.push('limit must be a non-negative integer');
    } else {
      parsedLimit = Number(limit);
      if (parsedLimit < 1 || parsedLimit > MAX_LIMIT) {
        details.push(`limit must be between 1 and ${MAX_LIMIT}`);
      }
    }
  }

  if (offset !== undefined) {
    if (!INTEGER_PATTERN.test(String(offset))) {
      details.push('offset must be a non-negative integer');
    } else {
      parsedOffset = Number(offset);
    }
  }

  if (details.length > 0) {
    res.status(400).json({ error: 'Validation failed', details });
    return null;
  }

  return { limit: parsedLimit, offset: parsedOffset };
}

module.exports = {
  UUID_PATTERN,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MAX_TRIP_DAYS,
  isNonEmptyString,
  isPlainObject,
  isPositiveInteger,
  unknownKeys,
  isUuid,
  isValidCalendarDate,
  isFiniteNumber,
  isInRange,
  dayCountInclusive,
  requireUuidParam,
  parsePagination,
};
