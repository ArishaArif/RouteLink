const HEAT_TIERS = ['cool', 'mild', 'warm', 'hot', 'extreme'];
const SLOT_TYPES = ['outdoor_active', 'outdoor_light', 'indoor_rest', 'travel', 'mixed'];
const ITINERARY_SOURCES = ['ml', 'manual', 'placeholder'];
const INDOOR_REST_SLOT = 'indoor_rest';

const DAY_ALIASES = {
  dayNumber: 'day_number',
  weatherContext: 'weather_context',
  hazardContext: 'hazard_context',
  slotType: 'slot_type',
  heatTier: 'heat_tier',
  needsMarketplaceData: 'needs_marketplace_data',
  fallbackMessage: 'fallback_message',
  modelVersion: 'model_version',
};

const ACTIVITY_ALIASES = {
  slotType: 'slot_type',
  heatTier: 'heat_tier',
};

function pick(raw, camelKey, snakeKey) {
  if (raw[camelKey] !== undefined) {
    return raw[camelKey];
  }
  return raw[snakeKey];
}

function normalizeAliases(raw, aliases) {
  const normalized = { ...raw };

  for (const [camelKey, snakeKey] of Object.entries(aliases)) {
    delete normalized[snakeKey];
    const value = pick(raw, camelKey, snakeKey);
    if (value === undefined) {
      delete normalized[camelKey];
    } else {
      normalized[camelKey] = value;
    }
  }

  return normalized;
}

function normalizeActivity(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return raw;
  }
  return normalizeAliases(raw, ACTIVITY_ALIASES);
}

function normalizeDay(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return raw;
  }

  const normalized = normalizeAliases(raw, DAY_ALIASES);

  if (Array.isArray(normalized.activities)) {
    normalized.activities = normalized.activities.map(normalizeActivity);
  }

  return normalized;
}

module.exports = {
  HEAT_TIERS,
  SLOT_TYPES,
  ITINERARY_SOURCES,
  INDOOR_REST_SLOT,
  normalizeDay,
  normalizeActivity,
};
