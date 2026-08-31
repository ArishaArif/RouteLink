const { Trip, Itinerary } = require('../models');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TRIP_STATUSES = ['planning', 'upcoming', 'ongoing', 'completed', 'cancelled'];
const UPDATABLE_FIELDS = ['title', 'destination', 'startDate', 'endDate', 'status', 'budget'];
const MAX_ITINERARY_DAYS = 60;

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidCalendarDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function tripIdOrNull(req, res) {
  const { id } = req.params;
  if (!UUID_PATTERN.test(id)) {
    res.status(400).json({ error: 'Trip id must be a valid UUID' });
    return null;
  }
  return id;
}

async function findOwnedTrip(tripId, userId) {
  return Trip.findOne({ where: { id: tripId, userId } });
}

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
    if (isValidCalendarDate(startDate) && isValidCalendarDate(endDate) && endDate < startDate) {
      details.push('endDate must be on or after startDate');
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
    const trips = await Trip.findAll({
      where: { userId: req.user.id },
      order: [['startDate', 'ASC'], ['createdAt', 'ASC']],
    });
    return res.status(200).json({ count: trips.length, trips });
  } catch (err) {
    return next(err);
  }
}

async function getTrip(req, res, next) {
  try {
    const tripId = tripIdOrNull(req, res);
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
    const tripId = tripIdOrNull(req, res);
    if (!tripId) {
      return undefined;
    }

    const trip = await findOwnedTrip(tripId, req.user.id);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const body = req.body || {};
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
    const tripId = tripIdOrNull(req, res);
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

async function getItinerary(req, res, next) {
  try {
    const tripId = tripIdOrNull(req, res);
    if (!tripId) {
      return undefined;
    }

    const trip = await findOwnedTrip(tripId, req.user.id);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const stored = await Itinerary.findAll({
      where: { tripId: trip.id },
      order: [['dayNumber', 'ASC']],
    });

    if (stored.length > 0) {
      return res.status(200).json({
        tripId: trip.id,
        destination: trip.destination,
        source: 'stored',
        days: stored.length,
        itinerary: stored,
      });
    }

    const dates = datesInRange(trip.startDate, trip.endDate);
    if (dates.length > MAX_ITINERARY_DAYS) {
      return res.status(422).json({
        error: `Trip spans ${dates.length} days, which exceeds the ${MAX_ITINERARY_DAYS}-day placeholder limit`,
      });
    }

    const itinerary = dates.map((date, index) => ({
      id: null,
      tripId: trip.id,
      dayNumber: index + 1,
      date,
      activities: placeholderActivities(trip.destination, index + 1),
      weatherContext: null,
    }));

    return res.status(200).json({
      tripId: trip.id,
      destination: trip.destination,
      source: 'placeholder',
      generatedAt: new Date().toISOString(),
      days: itinerary.length,
      itinerary,
    });
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
  getItinerary,
};
