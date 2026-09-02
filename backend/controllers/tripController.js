const { Trip } = require('../models');
const {
  isNonEmptyString,
  isValidCalendarDate,
  dayCountInclusive,
  requireUuidParam,
  parsePagination,
  unknownKeys,
  MAX_TRIP_DAYS,
} = require('../utils/validate');

const TRIP_STATUSES = ['planning', 'upcoming', 'ongoing', 'completed', 'cancelled'];
const UPDATABLE_FIELDS = ['title', 'destination', 'startDate', 'endDate', 'status', 'budget'];

async function findOwnedTrip(tripId, userId) {
  return Trip.findOne({ where: { id: tripId, userId } });
}

async function createTrip(req, res, next) {
  try {
    const { title, destination, startDate, endDate, status, budget } = req.body || {};
    const details = [];

    if (!isNonEmptyString(title)) {
      details.push('title is required');
    }
    if (!isNonEmptyString(destination)) {
      details.push('destination is required');
    }
    if (!isValidCalendarDate(startDate)) {
      details.push('startDate is required in YYYY-MM-DD format');
    }
    if (!isValidCalendarDate(endDate)) {
      details.push('endDate is required in YYYY-MM-DD format');
    }
    if (isValidCalendarDate(startDate) && isValidCalendarDate(endDate)) {
      if (endDate < startDate) {
        details.push('endDate must be on or after startDate');
      } else if (dayCountInclusive(startDate, endDate) > MAX_TRIP_DAYS) {
        details.push(`trip must span at most ${MAX_TRIP_DAYS} days`);
      }
    }
    if (status !== undefined && !TRIP_STATUSES.includes(status)) {
      details.push(`status must be one of: ${TRIP_STATUSES.join(', ')}`);
    }
    if (budget !== undefined && budget !== null && Number.isNaN(Number(budget))) {
      details.push('budget must be a number');
    }

    if (details.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details });
    }

    const trip = await Trip.create({
      userId: req.user.id,
      title: title.trim(),
      destination: destination.trim(),
      startDate,
      endDate,
      status: status || 'planning',
      budget: budget === undefined ? null : budget,
    });

    return res.status(201).json({ trip });
  } catch (err) {
    return next(err);
  }
}

async function listTrips(req, res, next) {
  try {
    const page = parsePagination(req, res);
    if (!page) {
      return undefined;
    }

    const { rows, count: total } = await Trip.findAndCountAll({
      where: { userId: req.user.id },
      order: [['startDate', 'ASC'], ['createdAt', 'ASC']],
      limit: page.limit,
      offset: page.offset,
    });

    return res.status(200).json({
      count: rows.length,
      total,
      limit: page.limit,
      offset: page.offset,
      trips: rows,
    });
  } catch (err) {
    return next(err);
  }
}

async function getTrip(req, res, next) {
  try {
    const tripId = requireUuidParam(req, res, 'id', 'Trip id');
    if (!tripId) {
      return undefined;
    }

    const trip = await findOwnedTrip(tripId, req.user.id);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    return res.status(200).json({ trip });
  } catch (err) {
    return next(err);
  }
}

async function updateTrip(req, res, next) {
  try {
    const tripId = requireUuidParam(req, res, 'id', 'Trip id');
    if (!tripId) {
      return undefined;
    }

    const trip = await findOwnedTrip(tripId, req.user.id);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const body = req.body || {};
    const unexpected = unknownKeys(body, UPDATABLE_FIELDS);
    if (unexpected.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: [
          `unexpected fields: ${unexpected.join(', ')}`,
          `updatable fields are: ${UPDATABLE_FIELDS.join(', ')}`,
        ],
      });
    }

    const provided = UPDATABLE_FIELDS.filter((field) => body[field] !== undefined);
    if (provided.length === 0) {
      return res.status(400).json({
        error: 'No updatable fields provided',
        details: [`provide at least one of: ${UPDATABLE_FIELDS.join(', ')}`],
      });
    }

    const details = [];
    if (body.title !== undefined && !isNonEmptyString(body.title)) {
      details.push('title must be a non-empty string');
    }
    if (body.destination !== undefined && !isNonEmptyString(body.destination)) {
      details.push('destination must be a non-empty string');
    }
    if (body.startDate !== undefined && !isValidCalendarDate(body.startDate)) {
      details.push('startDate must be in YYYY-MM-DD format');
    }
    if (body.endDate !== undefined && !isValidCalendarDate(body.endDate)) {
      details.push('endDate must be in YYYY-MM-DD format');
    }
    if (body.status !== undefined && !TRIP_STATUSES.includes(body.status)) {
      details.push(`status must be one of: ${TRIP_STATUSES.join(', ')}`);
    }
    if (body.budget !== undefined && body.budget !== null && Number.isNaN(Number(body.budget))) {
      details.push('budget must be a number');
    }

    if (details.length === 0) {
      const nextStart = body.startDate === undefined ? trip.startDate : body.startDate;
      const nextEnd = body.endDate === undefined ? trip.endDate : body.endDate;
      if (nextEnd < nextStart) {
        details.push('endDate must be on or after startDate');
      } else if (dayCountInclusive(nextStart, nextEnd) > MAX_TRIP_DAYS) {
        details.push(`trip must span at most ${MAX_TRIP_DAYS} days`);
      }
    }

    if (details.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details });
    }

    const updates = {};
    for (const field of provided) {
      updates[field] = typeof body[field] === 'string' && field !== 'startDate' && field !== 'endDate' && field !== 'status'
        ? body[field].trim()
        : body[field];
    }

    await trip.update(updates);
    return res.status(200).json({ trip, updated: provided });
  } catch (err) {
    return next(err);
  }
}

async function deleteTrip(req, res, next) {
  try {
    const tripId = requireUuidParam(req, res, 'id', 'Trip id');
    if (!tripId) {
      return undefined;
    }

    const trip = await findOwnedTrip(tripId, req.user.id);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    await trip.destroy();
    return res.status(200).json({ message: 'Trip deleted', id: tripId });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createTrip,
  listTrips,
  getTrip,
  updateTrip,
  deleteTrip,
};
