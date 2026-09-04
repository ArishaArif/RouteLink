const sosLookup = require('../services/sosLookup');
const { isFiniteNumber, isInRange } = require('../utils/validate');

const ALLOWED_TRIGGER_KEYS = ['userId', 'latitude', 'longitude', 'radiusMeters', 'note'];
const MAX_NOTE_LENGTH = 500;
const MAX_RADIUS_METERS = 100000;

function unknownKeys(body, allowed) {
  return Object.keys(body).filter((key) => !allowed.includes(key));
}

function firstPresent(...values) {
  for (const value of values) {
    if (value === undefined || value === null) {
      continue;
    }
    if (typeof value === 'string' && value.trim() === '') {
      continue;
    }
    return value;
  }
  return undefined;
}

function validateCoordinates(latitude, longitude, details) {
  if (!isFiniteNumber(latitude) || !isInRange(latitude, -90, 90)) {
    details.push('latitude is required and must be a number between -90 and 90');
  }
  if (!isFiniteNumber(longitude) || !isInRange(longitude, -180, 180)) {
    details.push('longitude is required and must be a number between -180 and 180');
  }
}

function resolveRadius(raw, details) {
  if (raw === undefined || raw === null) {
    return sosLookup.DEFAULT_RADIUS_METERS;
  }
  if (!isFiniteNumber(raw) || raw <= 0 || raw > MAX_RADIUS_METERS) {
    details.push(`radiusMeters must be a number between 1 and ${MAX_RADIUS_METERS}`);
    return sosLookup.DEFAULT_RADIUS_METERS;
  }
  return Number(raw);
}

async function triggerSos(req, res, next) {
  try {
    const body = req.body || {};
    const details = [];

    const unexpected = unknownKeys(body, ALLOWED_TRIGGER_KEYS);
    if (unexpected.length > 0) {
      details.push(`unexpected fields: ${unexpected.join(', ')}`);
      details.push(`accepted fields are: ${ALLOWED_TRIGGER_KEYS.join(', ')}`);
    }

    if (body.userId !== undefined && body.userId !== null && body.userId !== req.user.id) {
      return res.status(403).json({
        error: 'userId does not match the authenticated user',
        details: ['Omit userId — it is taken from your token.'],
      });
    }

    validateCoordinates(body.latitude, body.longitude, details);

    if (body.note !== undefined && body.note !== null) {
      if (typeof body.note !== 'string') {
        details.push('note must be a string');
      } else if (body.note.trim().length > MAX_NOTE_LENGTH) {
        details.push(`note must be at most ${MAX_NOTE_LENGTH} characters`);
      }
    }

    const radiusMeters = resolveRadius(body.radiusMeters, details);

    if (details.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details });
    }

    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);

    const lookup = await sosLookup.findNearestServices({ latitude, longitude, radiusMeters });

    return res.status(200).json({
      sos: {
        userId: req.user.id,
        latitude,
        longitude,
        note: typeof body.note === 'string' && body.note.trim() !== '' ? body.note.trim() : null,
        triggeredAt: new Date().toISOString(),
        persisted: false,
      },
      nearest: lookup,
    });
  } catch (err) {
    return next(err);
  }
}

async function nearestServices(req, res, next) {
  try {
    const details = [];
    const latitude = firstPresent(req.query.lat, req.query.latitude);
    const longitude = firstPresent(req.query.lng, req.query.longitude);

    validateCoordinates(latitude, longitude, details);
    const radiusMeters = resolveRadius(firstPresent(req.query.radiusMeters), details);

    const parsedLat = Number(latitude);
    const parsedLng = Number(longitude);

    if (details.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details });
    }

    const lookup = await sosLookup.findNearestServices({
      latitude: parsedLat,
      longitude: parsedLng,
      radiusMeters,
    });

    return res.status(200).json({
      query: { latitude: parsedLat, longitude: parsedLng, radiusMeters },
      nearest: lookup,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { triggerSos, nearestServices };
