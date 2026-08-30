// utils/jwt.js
// Reusable JWT helper. Actual login/signup endpoints (Day 2) will call
// signToken() after verifying credentials; they don't exist yet.

require('dotenv').config();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Sign a JWT for a given user.
 * @param {{ id: string, role: string }} payload - keep the payload small;
 *   don't put sensitive/mutable data in it since it's not re-checked
 *   against the DB on every request.
 * @returns {string} signed JWT
 */
function signToken(payload) {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not set in the environment');
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify a JWT and return its decoded payload.
 * Throws if the token is invalid/expired — callers should catch.
 * @param {string} token
 */
function verifyToken(token) {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not set in the environment');
  }
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { signToken, verifyToken };
