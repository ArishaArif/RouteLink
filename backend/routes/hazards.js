const express = require('express');
const { requireIngestKey } = require('../middleware/ingestAuth');
const { ingestHazard, listHazards } = require('../controllers/hazardController');

const router = express.Router();

router.post('/', requireIngestKey, ingestHazard);
router.get('/', listHazards);

module.exports = router;
