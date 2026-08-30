// middleware/auth.js
// Verifies an `Authorization: Bearer <token>` header and attaches the
// decoded payload to req.user. Routes/controllers built on Day 2 can wrap
// any route with `requireAuth`, and optionally `requireRole('guide')`.

const { verifyToken } = require('../utils/jwt');

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded; // e.g. { id, role, iat, exp }
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Optional role gate. Use after requireAuth: requireRole('guide')
 * @param {...string} allowedRoles
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole };
