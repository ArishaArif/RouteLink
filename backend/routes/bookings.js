const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  createBooking,
  listBookings,
  updateBookingStatus,
} = require('../controllers/bookingController');
const { sendMessage, listMessages } = require('../controllers/chatController');

const router = express.Router();

router.use(requireAuth);

router.post('/', createBooking);
router.get('/', listBookings);
router.patch('/:id/status', updateBookingStatus);
router.post('/:id/messages', sendMessage);
router.get('/:id/messages', listMessages);

module.exports = router;
