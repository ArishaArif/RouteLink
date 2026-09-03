const express = require('express');
const { requireIngestKey } = require('../middleware/ingestAuth');
const { hazardIngestLimiter } = require('../middleware/rateLimit');
const { ingestHazard, listHazards } = require('../controllers/hazardController');

const router = express.Router();

router.post('/', hazardIngestLimiter, requireIngestKey, ingestHazard);
router.get('/', listHazards);

module.exports = router;
