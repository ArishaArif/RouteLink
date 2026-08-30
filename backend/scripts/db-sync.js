// scripts/db-sync.js
// Run with: npm run db:sync
// Creates/updates Postgres tables to match the Sequelize models.
// Uses { alter: true } so it's safe to re-run during the hackathon as
// models evolve, without dropping existing data. Do NOT use this flow
// in production later — switch to proper migrations (sequelize-cli).

require('dotenv').config();
const { sequelize } = require('../models');

(async () => {
  try {
    await sequelize.authenticate();
    console.log('Connected to Postgres.');

    await sequelize.sync({ alter: true });
    console.log('All models synced successfully.');

    process.exit(0);
  } catch (err) {
    console.error('Failed to sync models:', err);
    process.exit(1);
  }
})();
