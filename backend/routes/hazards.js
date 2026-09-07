const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireIngestKey } = require('../middleware/ingestAuth');
const { hazardIngestLimiter } = require('../middleware/rateLimit');
const { ingestHazard, listHazards, classifyHazardText } = require('../controllers/hazardController');

const router = express.Router();

router.post('/', hazardIngestLimiter, requireIngestKey, ingestHazard);
router.get('/', listHazards);
router.post('/classify', requireAuth, classifyHazardText);

module.exports = router;
