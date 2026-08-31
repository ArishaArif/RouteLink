require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.status(200).json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'unreachable', message: err.message });
  }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/trips', require('./routes/trips'));

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
