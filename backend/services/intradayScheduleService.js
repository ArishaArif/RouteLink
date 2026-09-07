const mlClient = require('./mlClient');

// Translation tables: ML internal labels → backend contract enums
const HEAT_MAP = {
  comfortable: 'mild',
  hot: 'hot',
  extreme: 'extreme',
};

const SLOT_MAP = {
  outdoor_ok: 'outdoor_active',
  limited_outdoor: 'outdoor_light',
  limited_outdoor_hot: 'outdoor_light',
  indoor_only_extreme_heat: 'indoor_rest',
};

// Common destination names → supported ML city
const CITY_ALIASES = {
  'hunza valley': 'Hunza',
  'hunza': 'Hunza',
  'fairy meadows': 'Gilgit',
  'naltar valley': 'Gilgit',
  'attabad lake': 'Hunza',
  'khunjerab pass': 'Hunza',
  'naran': 'Naran',
  'kaghan': 'Naran',
  'saif ul malook': 'Naran',
  'skardu': 'Skardu',
  'shangrila': 'Skardu',
  'deosai': 'Skardu',
  'chilas': 'Chilas',
  'babusar pass': 'Chilas',
};

function resolveCity(destination) {
  const key = String(destination || '').trim().toLowerCase();
  return CITY_ALIASES[key] || null;
}

function normalizeSlotRow(row) {
  if (!row || typeof row !== 'object') return null;
  // Parse the comma-joined suggestion string into a picks array if picks
  // isn't already provided. ML's build_intraday_plan returns suggestions
  // as "Place A, Place B, Place C" — we split that here so the activity
  // builder can format it as "Visit Place A (+2 more nearby)".
  const rawSuggestion = row.suggestion || null;
  // When needs_marketplace_data is true, the suggestion is the ML fallback
  // message (a full sentence with commas) — not a destination list, so
  // we must NOT split it into picks.
  // When the suggestion starts with "No safe" it's an ML fallback message
  // (e.g. extreme heat advisory), not a destination list — use it as the
  // fallbackMessage so the frontend banner renders correctly.
  const isFallback = row.needs_marketplace_data === true
    || (typeof rawSuggestion === 'string' && rawSuggestion.startsWith('No safe'));
  const fallbackMessage = isFallback
    ? (row.fallback_message || row.fallbackMessage || rawSuggestion)
    : (row.fallback_message || row.fallbackMessage || null);
  const rawPicks = Array.isArray(row.picks) && row.picks.length > 0
    ? row.picks
    : !isFallback && typeof rawSuggestion === 'string' && rawSuggestion.length > 0
      ? rawSuggestion.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
  return {
    time: row.time || '09:00',
    tempC: typeof row.temp_c === 'number' ? row.temp_c : (typeof row.tempC === 'number' ? row.tempC : null),
    condition: row.condition || null,
    heatTier: HEAT_MAP[row.heat_tier] || HEAT_MAP[row.heatTier] || 'mild',
    slotType: SLOT_MAP[row.slot_type] || SLOT_MAP[row.slotType] || 'mixed',
    suggestion: rawSuggestion,
    picks: rawPicks,
    fallbackMessage,
  };
}

function buildDaysFromSlots(slots, tripDates) {
  // Group slots by their date field (ML returns a date per slot row)
  const byDate = new Map();
  for (const raw of slots) {
    const slot = normalizeSlotRow(raw);
    if (!slot) continue;
    const date = raw.date || raw.day || null;
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(slot);
  }

  // If ML returned no date field, treat all slots as a single day
  if (byDate.size === 0 && slots.length > 0) {
    const normalized = slots.map(normalizeSlotRow).filter(Boolean);
    byDate.set('day0', normalized);
  }

  const dateKeys = [...byDate.keys()];
  const days = [];

  // Clamp forecast days to trip length — if ML returns more forecast days
  // than the trip spans, discard surplus (avoids null dates on bulkCreate).
  // If ML returns fewer days, we use only what we have (no empty days).
  const maxDays = tripDates.length > 0 ? tripDates.length : dateKeys.length;
  for (let i = 0; i < Math.min(dateKeys.length, maxDays); i++) {
    const daySlots = byDate.get(dateKeys[i]);
    const date = tripDates[i] || null;
    const heatTiers = daySlots.map((s) => s.heatTier);
    const slotTypes = [...new Set(daySlots.map((s) => s.slotType))];

    // Pick worst heat tier
    const heatOrder = ['cool', 'mild', 'warm', 'hot', 'extreme'];
    const worstHeat = heatTiers.reduce((worst, h) => {
      return heatOrder.indexOf(h) > heatOrder.indexOf(worst) ? h : worst;
    }, 'mild');

    const slotType = slotTypes.length === 1 ? slotTypes[0] : 'mixed';

    const activities = daySlots.map((s, idx) => ({
      time: s.time,
      title: s.picks.length > 0
        ? `Visit ${s.picks[0]}${s.picks.length > 1 ? ` (+${s.picks.length - 1} more nearby)` : ''}`
        : s.suggestion || `Activity block ${idx + 1}`,
      location: s.picks[0] || null,
      notes: s.suggestion || null,
      slotType: s.slotType,
      heatTier: s.heatTier,
    }));

    const avgTemp = daySlots.reduce((sum, s) => sum + (s.tempC || 0), 0) / (daySlots.length || 1);

    days.push({
      dayNumber: i + 1,
      date,
      slotType,
      heatTier: worstHeat,
      weatherContext: { avgTempC: Math.round(avgTemp), condition: daySlots[0]?.condition || null },
      hazardContext: { activeAlerts: 0 },
      activities,
      needsMarketplaceData: slotType === 'indoor_rest',
      fallbackMessage: daySlots.find((s) => s.fallbackMessage)?.fallbackMessage || null,
    });
  }

  return days;
}

async function getIntradayItinerary(trip, { exclude = [] } = {}) {
  const city = resolveCity(trip.destination);

  if (!city) {
    return {
      source: 'mock',
      mocked: true,
      degraded: true,
      reason: 'city_not_supported',
      destination: trip.destination,
      days: [],
    };
  }

  if (!mlClient.isConfigured()) {
    return {
      source: 'mock',
      mocked: true,
      degraded: false,
      reason: 'ml_service_not_configured',
      destination: trip.destination,
      days: [],
    };
  }

  const result = await mlClient.fetchIntradayPlan(city, { exclude });

  if (result.ok && Array.isArray(result.data)) {
    const tripDates = trip.startDate && trip.endDate
      ? datesBetween(trip.startDate, trip.endDate)
      : [];
    const days = buildDaysFromSlots(result.data, tripDates);

    return {
      source: 'ml',
      mocked: false,
      degraded: false,
      reason: null,
      destination: trip.destination,
      days,
    };
  }

  return {
    source: 'mock',
    mocked: true,
    degraded: true,
    reason: result.reason || 'upstream_error',
    destination: trip.destination,
    days: [],
  };
}

function datesBetween(start, end) {
  const dates = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

module.exports = {
  getIntradayItinerary,
  resolveCity,
  normalizeSlotRow,
  buildDaysFromSlots,
  CITY_ALIASES,
};
