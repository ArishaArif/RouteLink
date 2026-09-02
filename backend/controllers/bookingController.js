const { Op } = require('sequelize');
const { Booking, Trip, Guide, User } = require('../models');
const {
  isUuid,
  isValidCalendarDate,
  dayCountInclusive,
  requireUuidParam,
  parsePagination,
} = require('../utils/validate');

const SETTABLE_STATUSES = ['confirmed', 'cancelled', 'completed'];
const BLOCKING_STATUSES = ['requested', 'pending', 'confirmed', 'completed'];

const PARTICIPANT_INCLUDE = [
  { model: Trip, as: 'trip', attributes: ['id', 'title', 'destination'] },
  {
    model: Guide,
    as: 'guide',
    attributes: ['id', 'userId', 'region', 'pricePerDay'],
    include: [{ model: User, as: 'user', attributes: ['id', 'name'] }],
  },
];

function publicBooking(booking) {
  const plain = typeof booking.get === 'function' ? booking.get({ plain: true }) : booking;

  return {
    id: plain.id,
    tripId: plain.tripId,
    guideId: plain.guideId,
    userId: plain.userId,
    startDate: plain.startDate,
    endDate: plain.endDate,
    status: plain.status,
    totalPrice: plain.totalPrice,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
    trip: plain.trip
      ? { id: plain.trip.id, title: plain.trip.title, destination: plain.trip.destination }
      : undefined,
    guide: plain.guide
      ? {
        id: plain.guide.id,
        userId: plain.guide.userId,
        region: plain.guide.region,
        pricePerDay: plain.guide.pricePerDay,
        name: plain.guide.user ? plain.guide.user.name : undefined,
      }
      : undefined,
  };
}

async function loadBookingWithParticipants(bookingId) {
  return Booking.findByPk(bookingId, { include: PARTICIPANT_INCLUDE });
}

function participantRole(booking, user) {
  if (booking.userId === user.id) {
    return 'traveler';
  }
  if (booking.guide && booking.guide.userId === user.id) {
    return 'guide';
  }
  if (user.role === 'admin') {
    return 'admin';
  }
  return null;
}

async function createBooking(req, res, next) {
  try {
    const { tripId, guideId, startDate, endDate } = req.body || {};
    const details = [];

    if (!isUuid(tripId)) {
      details.push('tripId is required and must be a valid UUID');
    }
    if (!isUuid(guideId)) {
      details.push('guideId is required and must be a valid UUID');
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

    if (details.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details });
    }

    const trip = await Trip.findOne({ where: { id: tripId, userId: req.user.id } });
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const guide = await Guide.findByPk(guideId);
    if (!guide) {
      return res.status(404).json({ error: 'Guide not found' });
    }
    if (guide.userId === req.user.id) {
      return res.status(400).json({ error: 'You cannot book your own guide listing' });
    }
    if (!guide.isAvailable) {
      return res.status(409).json({ error: 'This guide is not currently accepting bookings' });
    }

    if (startDate < trip.startDate || endDate > trip.endDate) {
      return res.status(400).json({
        error: 'Validation failed',
        details: [`booking dates must fall within the trip dates (${trip.startDate} to ${trip.endDate})`],
      });
    }

    const conflict = await Booking.findOne({
      where: {
        guideId,
        status: { [Op.in]: BLOCKING_STATUSES },
        startDate: { [Op.lte]: endDate },
        endDate: { [Op.gte]: startDate },
      },
    });
    if (conflict) {
      return res.status(409).json({
        error: 'This guide already has a booking overlapping those dates',
        conflict: {
          startDate: conflict.startDate,
          endDate: conflict.endDate,
          status: conflict.status,
        },
      });
    }

    const days = dayCountInclusive(startDate, endDate);
    const booking = await Booking.create({
      tripId,
      guideId,
      userId: req.user.id,
      startDate,
      endDate,
      status: 'requested',
      totalPrice: (Number(guide.pricePerDay) * days).toFixed(2),
    });

    const created = await loadBookingWithParticipants(booking.id);
    return res.status(201).json({ booking: publicBooking(created), days });
  } catch (err) {
    return next(err);
  }
}

async function listBookings(req, res, next) {
  try {
    const page = parsePagination(req, res);
    if (!page) {
      return undefined;
    }

    const ownListing = await Guide.findOne({
      where: { userId: req.user.id },
      attributes: ['id'],
    });

    const where = ownListing
      ? { [Op.or]: [{ userId: req.user.id }, { guideId: ownListing.id }] }
      : { userId: req.user.id };

    const { rows, count: total } = await Booking.findAndCountAll({
      where,
      include: PARTICIPANT_INCLUDE,
      order: [['createdAt', 'DESC']],
      limit: page.limit,
      offset: page.offset,
    });

    return res.status(200).json({
      count: rows.length,
      total,
      limit: page.limit,
      offset: page.offset,
      bookings: rows.map((booking) => ({
        ...publicBooking(booking),
        viewerRole: booking.userId === req.user.id ? 'traveler' : 'guide',
      })),
    });
  } catch (err) {
    return next(err);
  }
}

async function updateBookingStatus(req, res, next) {
  try {
    const bookingId = requireUuidParam(req, res, 'id', 'Booking id');
    if (!bookingId) {
      return undefined;
    }

    const { status } = req.body || {};
    if (!SETTABLE_STATUSES.includes(status)) {
      return res.status(400).json({
        error: 'Validation failed',
        details: [`status must be one of: ${SETTABLE_STATUSES.join(', ')}`],
      });
    }

    const booking = await loadBookingWithParticipants(bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const role = participantRole(booking, req.user);
    if (role === null) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    if (role === 'traveler') {
      return res.status(403).json({
        error: 'Only the assigned guide or an admin can change booking status',
      });
    }

    const previousStatus = booking.status;
    await booking.update({ status });

    return res.status(200).json({
      booking: publicBooking(booking),
      previousStatus,
      changedBy: role,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createBooking,
  listBookings,
  updateBookingStatus,
  loadBookingWithParticipants,
  participantRole,
  publicBooking,
};
