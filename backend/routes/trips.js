const express = require('express');
const { requireAuth, requireAuthOrService } = require('../middleware/auth');
const {
  createTrip,
  listTrips,
  getTrip,
  updateTrip,
  deleteTrip,
} = require('../controllers/tripController');
const { getItinerary, putItinerary } = require('../controllers/itineraryController');

const router = express.Router();

router.put('/:id/itinerary', requireAuthOrService, putItinerary);

router.use(requireAuth);

router.post('/', createTrip);
router.get('/', listTrips);
router.get('/:id', getTrip);
router.patch('/:id', updateTrip);
router.delete('/:id', deleteTrip);
router.get('/:id/itinerary', getItinerary);

module.exports = router;
