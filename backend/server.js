// server.js
// Minimal app entry point for Day 1. No feature routes are mounted yet —
// those get added under routes/ starting Day 2 (e.g. app.use('/api/trips', tripRoutes)).

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models');

const app = express();

app.use(cors());
app.use(express.json());

// Confirms the process is up AND that Postgres is reachable.
app.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.status(200).json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'unreachable', message: err.message });
  }
});

// --- Day 2+: mount feature routes here, e.g. ---
// app.use('/api/auth', require('./routes/auth.routes'));
// app.use('/api/trips', require('./routes/trip.routes'));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`RouteLink backend listening on port ${PORT}`);
});

module.exports = app;
