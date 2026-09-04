const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { triggerSos, nearestServices } = require('../controllers/sosController');

const router = express.Router();

router.use(requireAuth);

router.post('/', triggerSos);
router.get('/nearest', nearestServices);

module.exports = router;
