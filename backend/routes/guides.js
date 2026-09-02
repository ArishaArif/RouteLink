const express = require('express');
const { requireAuth, requireRole, optionalAuth } = require('../middleware/auth');
const {
  listGuides,
  getGuide,
  createGuide,
  updateGuide,
} = require('../controllers/guideController');

const router = express.Router();

router.get('/', optionalAuth, listGuides);
router.get('/:id', optionalAuth, getGuide);
router.post('/', requireAuth, requireRole('guide'), createGuide);
router.patch('/:id', requireAuth, updateGuide);

module.exports = router;
