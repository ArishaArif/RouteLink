const express = require('express');
const { signup, login } = require('../controllers/authController');
const { loginLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/signup', signup);
router.post('/login', loginLimiter, login);

module.exports = router;
