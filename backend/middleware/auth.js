const { User } = require('../models');
const { verifyToken } = require('../utils/jwt');
const { hasValidServiceKey } = require('./ingestAuth');

async function loadUserFromHeader(req) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (err) {
    return null;
  }

  return User.findByPk(decoded.id, { attributes: ['id', 'role', 'isActive'] });
}

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  try {
    const user = await User.findByPk(decoded.id, { attributes: ['id', 'role', 'isActive'] });
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is disabled' });
    }

    req.user = { id: user.id, role: user.role };
    return next();
  } catch (err) {
    return next(err);
  }
}

async function optionalAuth(req, res, next) {
  try {
    const user = await loadUserFromHeader(req);
    if (user && user.isActive) {
      req.user = { id: user.id, role: user.role };
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

function requireAuthOrService(req, res, next) {
  if (hasValidServiceKey(req)) {
    req.service = true;
    return next();
  }
  return requireAuth(req, res, next);
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        requiredRole: allowedRoles.join(' or '),
        yourRole: req.user.role,
      });
    }
    return next();
  };
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireAuthOrService,
  requireRole,
};
