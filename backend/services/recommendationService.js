const mlClient = require('./mlClient');
const itinerarySource = require('./itinerarySource');
const { normalizeDestinationName, destinationKey } = require('../utils/destinationState');
const { destinationId, describeDestination } = require('../utils/destinationIdentity');

const DEFAULT_POOL_SIZE = 8;
const MIN_POOL_SIZE = 1;
const MAX_POOL_SIZE = 20;

function clampPoolSize(value) {
  if (value === undefined) {
    return DEFAULT_POOL_SIZE;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_POOL_SIZE;
  }
  return Math.min(Math.max(parsed, MIN_POOL_SIZE), MAX_POOL_SIZE);
}

function coordinate(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeMlRow(row) {
  if (row === null || typeof row !== 'object') {
    return null;
  }
  if (!row.name) {
    return null;
  }

  const rawScore = row.similarity_score !== undefined ? row.similarity_score : row.match_score;
  const score = Number(rawScore !== undefined ? rawScore : row.score);
  const name = normalizeDestinationName(row.name);
  const category = row.category === undefined || row.category === null ? null : String(row.category);
  const province = row.province === undefined || row.province === null ? null : String(row.province);

  return {
    id: destinationId(name),
    name,
    category,
    province,
    location: province || 'Pakistan',
    description: describeDestination(name, category, province),
    latitude: coordinate(row.latitude),
    longitude: coordinate(row.longitude),
    imageUrl: null,
    score: Number.isFinite(score) ? score : null,
  };
}

function applyExclude(rows, exclude) {
  const excluded = new Set(exclude.map((name) => destinationKey(name)));
  const seen = new Set();

  return rows.filter((row) => {
    const key = destinationKey(row.name);
    if (excluded.has(key) || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

const EXTRA_COORDS = [
  { name: 'Passu Cones', latitude: 36.4667, longitude: 74.8833 },
  { name: 'Borith Lake', latitude: 36.4353, longitude: 74.8639 },
  { name: 'Rakaposhi View Point', latitude: 36.1500, longitude: 74.4833 },
  { name: 'Shangrila Resort', latitude: 35.2500, longitude: 75.5833 },
  { name: 'Baltit Fort', latitude: 36.3208, longitude: 74.6683 },
  { name: 'Altit Fort', latitude: 36.3133, longitude: 74.6742 },
  { name: 'Saif ul Malook', latitude: 34.8797, longitude: 73.6931 },
  { name: 'Babusar Pass', latitude: 35.1500, longitude: 74.0000 },
];

const KNOWN_COORDS = new Map(
  [...itinerarySource.CANDIDATE_DESTINATIONS, ...EXTRA_COORDS].map((candidate) => [
    destinationKey(candidate.name),
    { latitude: candidate.latitude, longitude: candidate.longitude },
  ]),
);

function withKnownCoords(row) {
  if (row.latitude !== null && row.longitude !== null) {
    return row;
  }
  const known = KNOWN_COORDS.get(destinationKey(row.name));
  if (!known) {
    return row;
  }
  return {
    ...row,
    latitude: row.latitude === null ? known.latitude : row.latitude,
    longitude: row.longitude === null ? known.longitude : row.longitude,
  };
}

function fallbackPool(exclude, poolSize, destination) {
  const excludeWithOrigin = destination ? [...exclude, destination] : exclude;
  const ranked = itinerarySource.rankCandidates(excludeWithOrigin, poolSize);
  return applyExclude(ranked.map(normalizeMlRow).filter(Boolean), excludeWithOrigin).slice(0, poolSize);
}

function topUp(rows, exclude, poolSize, destination) {
  if (rows.length >= poolSize) {
    return rows;
  }
  const alreadyServed = rows.map((row) => row.name);
  const filler = fallbackPool([...exclude, ...alreadyServed], poolSize - rows.length, destination);
  return [...rows, ...filler];
}

async function getRecommendations(destination, { exclude = [], poolSize } = {}) {
  const size = clampPoolSize(poolSize);
  const name = normalizeDestinationName(destination);

  if (!mlClient.isConfigured()) {
    return {
      destination: name,
      source: 'mock',
      mocked: true,
      degraded: false,
      reason: 'ml_service_not_configured',
      excludeApplied: exclude,
      recommendations: fallbackPool(exclude, size, name),
    };
  }

  const result = await mlClient.fetchSimilarDestinations(name, { topN: size, exclude });

  if (result.ok && Array.isArray(result.data)) {
    const mapped = result.data.map(normalizeMlRow).filter(Boolean).map(withKnownCoords);
    const rows = applyExclude(mapped, [...exclude, name]).slice(0, size);
    const topped = topUp(rows, exclude, size, name);

    return {
      destination: name,
      source: 'ml',
      mocked: false,
      degraded: false,
      reason: null,
      excludeApplied: exclude,
      recommendations: topped,
    };
  }

  if (result.reason === 'not_in_catalog') {
    return {
      destination: name,
      source: 'mock',
      mocked: true,
      degraded: true,
      reason: 'not_in_catalog',
      excludeApplied: exclude,
      recommendations: fallbackPool(exclude, size, name),
    };
  }

  return {
    destination: name,
    source: 'mock',
    mocked: true,
    degraded: true,
    reason: result.reason || 'upstream_error',
    excludeApplied: exclude,
    recommendations: fallbackPool(exclude, size, name),
  };
}

module.exports = {
  getRecommendations,
  clampPoolSize,
  normalizeMlRow,
  applyExclude,
  fallbackPool,
  topUp,
  DEFAULT_POOL_SIZE,
  MIN_POOL_SIZE,
  MAX_POOL_SIZE,
};
