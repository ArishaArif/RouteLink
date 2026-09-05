const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  createBooking,
  listBookings,
  updateBookingStatus,
} = require('../controllers/bookingController');

const router = express.Router();

router.use(requireAuth);

router.post('/', createBooking);
router.get('/', listBookings);
router.patch('/:id/status', updateBookingStatus);

module.exports = router;
