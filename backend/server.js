require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { sequelize } = require('./models');

const app = express();

function trustProxySetting(raw) {
  const value = raw.trim();
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  if (/^\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }
  return value;
}

if (process.env.TRUST_PROXY && process.env.TRUST_PROXY.trim() !== '') {
  app.set('trust proxy', trustProxySetting(process.env.TRUST_PROXY));
}

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(cors(allowedOrigins.length > 0 ? { origin: allowedOrigins, credentials: true } : undefined));
app.use(express.json());

app.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.status(200).json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'unreachable', message: err.message });
  }
});

// Serves the destination photos the ML pipeline downloaded locally (one-time
// download from Wikipedia, kept on disk on purpose to avoid re-hitting
// Wikipedia's API -- see ml-pipeline/scripts/wikimedia_photo_lookup.py).
// Mounted here, not on the ML microservice, so the phone app only ever needs
// to know Backend's address -- not a second host for images.
// Helmet's default Cross-Origin-Resource-Policy: same-origin would otherwise
// block the mobile app / Expo web from loading these images cross-origin.
const ML_IMAGES_DIR = process.env.ML_IMAGES_DIR
  || path.join(__dirname, '../ml-pipeline/data/processed/destination_images');
app.use(
  '/destination-images',
  (req, res, next) => {
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(ML_IMAGES_DIR)
);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/trips', require('./routes/trips'));
app.use('/api/guides', require('./routes/guides'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/hazards', require('./routes/hazards'));
app.use('/api/sos', require('./routes/sos'));
app.use('/api/recommendations', require('./routes/recommendations'));
app.use('/api/chatbot', require('./routes/chatbot'));

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', method: req.method, path: req.originalUrl });
});

app.use((err, req, res, next) => {
  const sequelizeDetails = Array.isArray(err.errors) ? err.errors.map((e) => e.message) : [];

  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ error: 'Resource already exists', details: sequelizeDetails });
  }
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({ error: 'Validation failed', details: sequelizeDetails });
  }
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(400).json({ error: 'Referenced resource does not exist' });
  }

  const status = err.status || err.statusCode || 500;
  if (status >= 500) {
    console.error(err);
  }
  return res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message });
});

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`RouteLink backend listening on port ${PORT}`);
  });
}

module.exports = app;
