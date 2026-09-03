const { Trip, Itinerary, sequelize } = require('../models');
const { enrichItinerary } = require('../services/itineraryEnricher');
const itinerarySource = require('../services/itinerarySource');
const { getUserExcludeList } = require('../services/getUserExcludeList');
const {
  HEAT_TIERS,
  SLOT_TYPES,
  normalizeDay,
  resolveNeedsMarketplaceData,
} = require('../utils/itineraryContract');
const {
  isNonEmptyString,
  isPlainObject,
  isPositiveInteger,
  isValidCalendarDate,
  requireUuidParam,
  MAX_TRIP_DAYS,
} = require('../utils/validate');

const WRITE_SOURCES = ['ml', 'manual'];
const MAX_ACTIVITIES_PER_DAY = 50;
const MAX_FALLBACK_MESSAGE_LENGTH = 500;
const KNOWN_DAY_KEYS = [
  'dayNumber',
  'date',
  'activities',
  'weatherContext',
  'hazardContext',
  'slotType',
  'heatTier',
  'needsMarketplaceData',
  'fallbackMessage',
  'modelVersion',
];

function datesInRange(startDate, endDate) {
  const dates = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const last = new Date(`${endDate}T00:00:00Z`);
  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function placeholderActivities(destination, dayNumber) {
  return [
    {
      time: '09:00',
      title: `Morning exploration around ${destination}`,
      location: destination,
      notes: 'Placeholder activity - awaiting AI recommender',
    },
    {
      time: '14:00',
      title: `Afternoon viewpoint stop (day ${dayNumber})`,
      location: destination,
      notes: 'Placeholder activity - awaiting AI recommender',
    },
  ];
}

function publicDay(day) {
  const plain = typeof day.get === 'function' ? day.get({ plain: true }) : day;

  return {
    id: plain.id === undefined ? null : plain.id,
    tripId: plain.tripId,
    dayNumber: plain.dayNumber,
    date: plain.date,
    activities: plain.activities,
    weatherContext: plain.weatherContext === undefined ? null : plain.weatherContext,
    hazardContext: plain.hazardContext === undefined ? null : plain.hazardContext,
    slotType: plain.slotType === undefined ? null : plain.slotType,
    heatTier: plain.heatTier === undefined ? null : plain.heatTier,
    needsMarketplaceData: plain.needsMarketplaceData === true,
    fallbackMessage: plain.fallbackMessage === undefined ? null : plain.fallbackMessage,
    source: plain.source,
    modelVersion: plain.modelVersion === undefined ? null : plain.modelVersion,
  };
}

async function findVisibleTrip(req, tripId) {
  if (req.service) {
    return Trip.findByPk(tripId);
  }
  return Trip.findOne({ where: { id: tripId, userId: req.user.id } });
}

function validateActivities(day, label, details) {
  if (day.activities === undefined) {
    details.push(`${label}.activities is required`);
    return;
  }
  if (!Array.isArray(day.activities)) {
    details.push(`${label}.activities must be an array`);
    return;
  }
  if (day.activities.length > MAX_ACTIVITIES_PER_DAY) {
    details.push(`${label}.activities must contain at most ${MAX_ACTIVITIES_PER_DAY} entries`);
    return;
  }

  day.activities.forEach((activity, index) => {
    const activityLabel = `${label}.activities[${index}]`;
    if (!isPlainObject(activity)) {
      details.push(`${activityLabel} must be an object`);
      return;
    }
    if (activity.slotType !== undefined && !SLOT_TYPES.includes(activity.slotType)) {
      details.push(`${activityLabel}.slotType must be one of: ${SLOT_TYPES.join(', ')}`);
    }
    if (activity.heatTier !== undefined && !HEAT_TIERS.includes(activity.heatTier)) {
      details.push(`${activityLabel}.heatTier must be one of: ${HEAT_TIERS.join(', ')}`);
    }
  });
}

function validateDay(day, index, trip, seenDayNumbers, details, ignored) {
  const label = `days[${index}]`;

  if (!isPlainObject(day)) {
    details.push(`${label} must be an object`);
    return;
  }

  Object.keys(day)
    .filter((key) => !KNOWN_DAY_KEYS.includes(key))
    .forEach((key) => ignored.add(key));

  if (!isPositiveInteger(day.dayNumber)) {
    details.push(`${label}.dayNumber must be a positive integer`);
  } else if (seenDayNumbers.has(day.dayNumber)) {
    details.push(`${label}.dayNumber ${day.dayNumber} is duplicated`);
  } else {
    seenDayNumbers.add(day.dayNumber);
  }

  if (!isValidCalendarDate(day.date)) {
    details.push(`${label}.date is required in YYYY-MM-DD format`);
  } else if (day.date < trip.startDate || day.date > trip.endDate) {
    details.push(`${label}.date must fall within the trip dates (${trip.startDate} to ${trip.endDate})`);
  }

  validateActivities(day, label, details);

  if (day.slotType !== undefined && day.slotType !== null && !SLOT_TYPES.includes(day.slotType)) {
    details.push(`${label}.slotType must be one of: ${SLOT_TYPES.join(', ')}`);
  }
  if (day.heatTier !== undefined && day.heatTier !== null && !HEAT_TIERS.includes(day.heatTier)) {
    details.push(`${label}.heatTier must be one of: ${HEAT_TIERS.join(', ')}`);
  }
  if (day.needsMarketplaceData !== undefined && typeof day.needsMarketplaceData !== 'boolean') {
    details.push(`${label}.needsMarketplaceData must be a boolean`);
  }
  if (day.fallbackMessage !== undefined && day.fallbackMessage !== null) {
    if (typeof day.fallbackMessage !== 'string') {
      details.push(`${label}.fallbackMessage must be a string`);
    } else if (day.fallbackMessage.length > MAX_FALLBACK_MESSAGE_LENGTH) {
      details.push(`${label}.fallbackMessage must be at most ${MAX_FALLBACK_MESSAGE_LENGTH} characters`);
    }
  }
  if (day.weatherContext !== undefined && day.weatherContext !== null && !isPlainObject(day.weatherContext)) {
    details.push(`${label}.weatherContext must be an object`);
  }
  if (day.hazardContext !== undefined && day.hazardContext !== null && !isPlainObject(day.hazardContext)) {
    details.push(`${label}.hazardContext must be an object`);
  }
  if (day.modelVersion !== undefined && day.modelVersion !== null && !isNonEmptyString(day.modelVersion)) {
    details.push(`${label}.modelVersion must be a non-empty string`);
  }
}

function buildRow(day, trip, source, modelVersion) {
  const slotType = day.slotType === undefined ? null : day.slotType;
  const needsMarketplaceData = resolveNeedsMarketplaceData(slotType, day.needsMarketplaceData);

  return {
    tripId: trip.id,
    dayNumber: day.dayNumber,
    date: day.date,
    activities: day.activities,
    weatherContext: day.weatherContext === undefined ? null : day.weatherContext,
    hazardContext: day.hazardContext === undefined ? null : day.hazardContext,
    slotType,
    heatTier: day.heatTier === undefined ? null : day.heatTier,
    needsMarketplaceData,
    fallbackMessage: day.fallbackMessage === undefined ? null : day.fallbackMessage,
    source,
    modelVersion: day.modelVersion === undefined ? modelVersion : day.modelVersion,
  };
}

async function putItinerary(req, res, next) {
  try {
    const tripId = requireUuidParam(req, res, 'id', 'Trip id');
    if (!tripId) {
      return undefined;
    }

    const trip = await findVisibleTrip(req, tripId);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const body = normalizeDay(req.body || {});

    if (!Array.isArray(body.days)) {
      return res.status(400).json({
        error: 'Validation failed',
        details: ['days is required and must be an array'],
      });
    }

    const details = [];
    const ignored = new Set();

    if (body.days.length === 0) {
      details.push('days must contain at least one day');
    }
    if (body.days.length > MAX_TRIP_DAYS) {
      details.push(`days must contain at most ${MAX_TRIP_DAYS} entries`);
    }

    const modelVersion = body.modelVersion === undefined ? null : body.modelVersion;
    if (modelVersion !== null && !isNonEmptyString(modelVersion)) {
      details.push('modelVersion must be a non-empty string');
    }

    const defaultSource = req.service ? 'ml' : 'manual';
    const source = body.source === undefined ? defaultSource : body.source;
    if (!WRITE_SOURCES.includes(source)) {
      details.push(`source must be one of: ${WRITE_SOURCES.join(', ')}`);
    }

    const normalized = body.days.map(normalizeDay);
    const seenDayNumbers = new Set();
    normalized.forEach((day, index) => validateDay(day, index, trip, seenDayNumbers, details, ignored));

    if (details.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details });
    }

    const rows = normalized.map((day) => buildRow(day, trip, source, modelVersion));

    const created = await sequelize.transaction(async (transaction) => {
      await Itinerary.destroy({ where: { tripId: trip.id }, transaction });
      return Itinerary.bulkCreate(rows, { transaction, returning: true });
    });

    const days = await enrichItinerary(
      created.map(publicDay).sort((a, b) => a.dayNumber - b.dayNumber),
      trip,
    );

    return res.status(200).json({
      tripId: trip.id,
      destination: trip.destination,
      source: 'stored',
      writtenBy: req.service ? 'service' : 'owner',
      days: days.length,
      modelVersion,
      ignoredFields: [...ignored].sort(),
      itinerary: days,
    });
  } catch (err) {
    return next(err);
  }
}

async function getItinerary(req, res, next) {
  try {
    const tripId = requireUuidParam(req, res, 'id', 'Trip id');
    if (!tripId) {
      return undefined;
    }

    const trip = await findVisibleTrip(req, tripId);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const stored = await Itinerary.findAll({
      where: { tripId: trip.id },
      order: [['dayNumber', 'ASC']],
    });

    if (stored.length > 0) {
      const days = await enrichItinerary(stored.map(publicDay), trip);
      return res.status(200).json({
        tripId: trip.id,
        destination: trip.destination,
        source: 'stored',
        days: days.length,
        modelVersion: days[0].modelVersion,
        itinerary: days,
      });
    }

    const dates = datesInRange(trip.startDate, trip.endDate);
    if (dates.length > MAX_TRIP_DAYS) {
      return res.status(422).json({
        error: `Trip spans ${dates.length} days, which exceeds the ${MAX_TRIP_DAYS}-day placeholder limit`,
      });
    }

    if (itinerarySource.isEnabled()) {
      const excludeList = await getUserExcludeList(trip.userId);
      const fetched = await itinerarySource.fetchItinerary(trip, dates, { exclude: excludeList });
      const normalized = fetched.days.map((day) => {
        const camel = normalizeDay(day);
        return publicDay({
          id: null,
          tripId: trip.id,
          dayNumber: camel.dayNumber,
          date: camel.date,
          activities: Array.isArray(camel.activities) ? camel.activities : [],
          weatherContext: camel.weatherContext ?? null,
          hazardContext: camel.hazardContext ?? null,
          slotType: camel.slotType ?? null,
          heatTier: camel.heatTier ?? null,
          needsMarketplaceData: resolveNeedsMarketplaceData(
            camel.slotType ?? null,
            camel.needsMarketplaceData
          ),
          fallbackMessage: camel.fallbackMessage ?? null,
          source: 'ml-preview',
          modelVersion: fetched.modelVersion,
        });
      });

      const days = await enrichItinerary(normalized, trip);

      return res.status(200).json({
        tripId: trip.id,
        destination: trip.destination,
        source: 'ml-preview',
        mocked: fetched.mocked === true,
        generator: fetched.generator,
        generatedAt: new Date().toISOString(),
        excludeApplied: Array.isArray(fetched.excludeApplied) ? fetched.excludeApplied : excludeList,
        recommendationPool: Array.isArray(fetched.recommendations) ? fetched.recommendations : [],
        days: days.length,
        modelVersion: fetched.modelVersion,
        itinerary: days,
      });
    }

    const itinerary = dates.map((date, index) => publicDay({
      id: null,
      tripId: trip.id,
      dayNumber: index + 1,
      date,
      activities: placeholderActivities(trip.destination, index + 1),
      weatherContext: null,
      hazardContext: null,
      slotType: null,
      heatTier: null,
      needsMarketplaceData: false,
      fallbackMessage: null,
      source: 'placeholder',
      modelVersion: null,
    }));

    return res.status(200).json({
      tripId: trip.id,
      destination: trip.destination,
      source: 'placeholder',
      generatedAt: new Date().toISOString(),
      days: itinerary.length,
      modelVersion: null,
      itinerary,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { getItinerary, putItinerary, publicDay };
