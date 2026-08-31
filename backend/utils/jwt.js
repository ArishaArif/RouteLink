require('dotenv').config();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function signToken(payload) {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not set in the environment');
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not set in the environment');
  }
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { signToken, verifyToken };
