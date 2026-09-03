const { destinationKey } = require('../utils/destinationState');

const MOCK_MODEL_VERSION = 'mock-ml-v0.0.1';
const RECOMMENDATION_POOL_SIZE = 8;

const CANDIDATE_DESTINATIONS = [
  { name: 'Hunza Valley', category: 'valley', province: 'Gilgit-Baltistan' },
  { name: 'Fairy Meadows', category: 'meadow', province: 'Gilgit-Baltistan' },
  { name: 'Skardu', category: 'town', province: 'Gilgit-Baltistan' },
  { name: 'Attabad Lake', category: 'lake', province: 'Gilgit-Baltistan' },
  { name: 'Naltar Valley', category: 'valley', province: 'Gilgit-Baltistan' },
  { name: 'Deosai National Park', category: 'plateau', province: 'Gilgit-Baltistan' },
  { name: 'Khunjerab Pass', category: 'mountain pass', province: 'Gilgit-Baltistan' },
  { name: 'Neelum Valley', category: 'valley', province: 'Azad Kashmir' },
  { name: 'Ratti Gali Lake', category: 'lake', province: 'Azad Kashmir' },
  { name: 'Swat Valley', category: 'valley', province: 'Khyber Pakhtunkhwa' },
  { name: 'Kalash Valleys', category: 'valley', province: 'Khyber Pakhtunkhwa' },
];

function rankCandidates(exclude) {
  const excluded = new Set(exclude.map((name) => destinationKey(name)));

  return CANDIDATE_DESTINATIONS
    .filter((candidate) => !excluded.has(destinationKey(candidate.name)))
    .slice(0, RECOMMENDATION_POOL_SIZE)
    .map((candidate, index) => ({
      ...candidate,
      score: Number((0.95 - index * 0.06).toFixed(3)),
    }));
}

function mockDays(trip, dates) {
  const rotation = ['outdoor_active', 'outdoor_light', 'indoor_rest', 'travel'];
  const heatRotation = ['warm', 'hot', 'extreme', 'mild'];

  return dates.map((date, index) => {
    const slot = rotation[index % rotation.length];
    const heat = heatRotation[index % heatRotation.length];
    const resting = slot === 'indoor_rest';

    return {
      day_number: index + 1,
      date,
      slot_type: slot,
      heat_tier: heat,
      weather_context: { highC: 34 + (index % 6), lowC: 21 + (index % 4), condition: 'clear' },
      hazard_context: { activeAlerts: 0 },
      needs_marketplace_data: resting,
      fallback_message: resting
        ? 'Outdoor activity is unsafe at this heat tier. See the Guide Marketplace for verified options.'
        : null,
      activities: resting
        ? []
        : [
          {
            time: '08:00',
            title: `Morning exploration around ${trip.destination}`,
            location: trip.destination,
            notes: 'Start early to avoid peak heat.',
            slot_type: slot,
          },
          {
            time: '16:30',
            title: 'Late afternoon viewpoint walk',
            location: trip.destination,
            notes: null,
            slot_type: 'outdoor_light',
          },
        ],
    };
  });
}

function isEnabled() {
  return process.env.ITINERARY_ML_MOCK === 'true';
}

async function fetchItinerary(trip, dates, options = {}) {
  const exclude = Array.isArray(options.exclude) ? options.exclude : [];

  return {
    mocked: true,
    generator: 'mock',
    modelVersion: MOCK_MODEL_VERSION,
    excludeApplied: exclude,
    recommendations: rankCandidates(exclude),
    days: mockDays(trip, dates),
  };
}

module.exports = {
  fetchItinerary,
  isEnabled,
  rankCandidates,
  MOCK_MODEL_VERSION,
  RECOMMENDATION_POOL_SIZE,
  CANDIDATE_DESTINATIONS,
};
