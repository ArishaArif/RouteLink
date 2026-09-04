const crypto = require('crypto');

function hazardIngestKey() {
  return process.env.HAZARD_INGEST_KEY;
}

function mlServiceKey() {
  return process.env.ML_SERVICE_KEY;
}

function safeEqual(provided, expected) {
  const providedBuffer = Buffer.from(provided, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

function matchesKey(req, expected) {
  if (!expected) {
    return false;
  }
  const provided = req.headers['x-ingest-key'];
  return typeof provided === 'string' && safeEqual(provided, expected);
}

function hasValidHazardIngestKey(req) {
  return matchesKey(req, hazardIngestKey());
}

function hasValidServiceKey(req) {
  return matchesKey(req, mlServiceKey());
}

function requireIngestKey(req, res, next) {
  if (!hazardIngestKey()) {
    return res.status(500).json({ error: 'Hazard ingest is not configured on this server' });
  }
  if (!hasValidHazardIngestKey(req)) {
    return res.status(401).json({ error: 'Missing or invalid ingest key' });
  }
  return next();
}

module.exports = {
  requireIngestKey,
  hasValidServiceKey,
  hasValidHazardIngestKey,
  hazardIngestKey,
  mlServiceKey,
};
