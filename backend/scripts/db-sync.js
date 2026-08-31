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
