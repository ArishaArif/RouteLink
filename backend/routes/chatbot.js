const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { sendMessage } = require('../controllers/chatbotController');

const router = express.Router();

router.use(requireAuth);
router.post('/message', sendMessage);

module.exports = router;
