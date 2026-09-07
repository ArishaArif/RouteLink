const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { listRecommendations, listPreferenceRecommendations, getDestinationPhoto } = require('../controllers/recommendationController');

const router = express.Router();

router.use(requireAuth);

router.get('/', listRecommendations);
router.post('/preferences', listPreferenceRecommendations);
router.get('/photo', getDestinationPhoto);

module.exports = router;
