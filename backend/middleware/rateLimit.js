const rateLimit = require('express-rate-limit');

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_AUTH_MAX = 30;
const DEFAULT_HAZARD_MAX = 60;

function intFromEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function windowMs() {
  return intFromEnv('RATE_LIMIT_WINDOW_MS', DEFAULT_WINDOW_MS);
}

function build(maxEnvName, defaultMax, error) {
  return rateLimit({
    windowMs: windowMs(),
    max: intFromEnv(maxEnvName, defaultMax),
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.RATE_LIMIT_DISABLED === 'true',
    handler: (req, res) => {
      const retryAfterSeconds = Math.ceil(windowMs() / 1000);
      res.set('Retry-After', String(retryAfterSeconds));
      res.status(429).json({ error, retryAfterSeconds });
    },
  });
}

const loginLimiter = build(
  'AUTH_RATE_LIMIT_MAX',
  DEFAULT_AUTH_MAX,
  'Too many login attempts. Try again later.'
);

const hazardIngestLimiter = build(
  'HAZARD_RATE_LIMIT_MAX',
  DEFAULT_HAZARD_MAX,
  'Too many hazard ingest requests. Try again later.'
);

module.exports = { loginLimiter, hazardIngestLimiter };
