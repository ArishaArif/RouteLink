const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { listRecommendations } = require('../controllers/recommendationController');

const router = express.Router();

router.use(requireAuth);

router.get('/', listRecommendations);

module.exports = router;
