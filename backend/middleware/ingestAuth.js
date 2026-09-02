const crypto = require('crypto');

function serviceKey() {
  return process.env.ML_SERVICE_KEY || process.env.HAZARD_INGEST_KEY;
}

function safeEqual(provided, expected) {
  const providedBuffer = Buffer.from(provided, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

function hasValidServiceKey(req) {
  const expected = serviceKey();
  if (!expected) {
    return false;
  }
  const provided = req.headers['x-ingest-key'];
  return typeof provided === 'string' && safeEqual(provided, expected);
}

function requireIngestKey(req, res, next) {
  if (!serviceKey()) {
    return res.status(500).json({ error: 'Hazard ingest is not configured on this server' });
  }
  if (!hasValidServiceKey(req)) {
    return res.status(401).json({ error: 'Missing or invalid ingest key' });
  }
  return next();
}

module.exports = { requireIngestKey, hasValidServiceKey, serviceKey };
