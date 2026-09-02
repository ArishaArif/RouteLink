const { ChatMessage, User } = require('../models');
const { isNonEmptyString, requireUuidParam } = require('../utils/validate');
const { loadBookingWithParticipants } = require('./bookingController');

const MAX_TEXT_LENGTH = 4000;

function publicMessage(message) {
  const plain = typeof message.get === 'function' ? message.get({ plain: true }) : message;

  return {
    id: plain.id,
    bookingId: plain.bookingId,
    senderId: plain.senderId,
    text: plain.text,
    createdAt: plain.createdAt,
    sender: plain.sender ? { id: plain.sender.id, name: plain.sender.name } : undefined,
  };
}

async function resolveConversation(req, res) {
  const bookingId = requireUuidParam(req, res, 'id', 'Booking id');
  if (!bookingId) {
    return null;
  }

  const booking = await loadBookingWithParticipants(bookingId);
  if (!booking) {
    res.status(404).json({ error: 'Booking not found' });
    return null;
  }

  let role = null;
  if (booking.userId === req.user.id) {
    role = 'traveler';
  } else if (booking.guide && booking.guide.userId === req.user.id) {
    role = 'guide';
  }

  if (role === null) {
    res.status(404).json({ error: 'Booking not found' });
    return null;
  }

  return { booking, role };
}

async function sendMessage(req, res, next) {
  try {
    const conversation = await resolveConversation(req, res);
    if (!conversation) {
      return undefined;
    }

    const { text } = req.body || {};
    if (!isNonEmptyString(text)) {
      return res.status(400).json({
        error: 'Validation failed',
        details: ['text is required and must be a non-empty string'],
      });
    }
    if (text.trim().length > MAX_TEXT_LENGTH) {
      return res.status(400).json({
        error: 'Validation failed',
        details: [`text must be at most ${MAX_TEXT_LENGTH} characters`],
      });
    }

    const message = await ChatMessage.create({
      bookingId: conversation.booking.id,
      senderId: req.user.id,
      text: text.trim(),
    });

    const created = await ChatMessage.findByPk(message.id, {
      include: [{ model: User, as: 'sender', attributes: ['id', 'name'] }],
    });

    return res.status(201).json({
      message: publicMessage(created),
      sentAs: conversation.role,
    });
  } catch (err) {
    return next(err);
  }
}

async function listMessages(req, res, next) {
  try {
    const conversation = await resolveConversation(req, res);
    if (!conversation) {
      return undefined;
    }

    const messages = await ChatMessage.findAll({
      where: { bookingId: conversation.booking.id },
      include: [{ model: User, as: 'sender', attributes: ['id', 'name'] }],
      order: [['createdAt', 'ASC'], ['id', 'ASC']],
    });

    return res.status(200).json({
      bookingId: conversation.booking.id,
      viewingAs: conversation.role,
      count: messages.length,
      messages: messages.map(publicMessage),
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { sendMessage, listMessages };
