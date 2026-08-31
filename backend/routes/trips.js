const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  createTrip,
  listTrips,
  getTrip,
  updateTrip,
  deleteTrip,
  getItinerary,
} = require('../controllers/tripController');

const router = express.Router();

router.use(requireAuth);

router.post('/', createTrip);
router.get('/', listTrips);
router.get('/:id', getTrip);
router.patch('/:id', updateTrip);
router.delete('/:id', deleteTrip);
router.get('/:id/itinerary', getItinerary);

module.exports = router;
