const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { setDestinationState, listDestinationState } = require('../controllers/destinationStateController');

const router = express.Router();

router.use(requireAuth);

router.post('/me/destination-state', setDestinationState);
router.get('/me/destination-state', listDestinationState);

module.exports = router;
