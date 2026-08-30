// config/database.js
// Single Sequelize instance, configured from environment variables.
// Every model and script should import the instance from here (or via
// models/index.js, which re-exports it) rather than creating its own.

require('dotenv').config();
const { Sequelize } = require('sequelize');

const {
  DB_HOST,
  DB_PORT,
  DB_NAME,
  DB_USER,
  DB_PASSWORD,
  NODE_ENV,
} = process.env;

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: DB_PORT ? Number(DB_PORT) : 5432,
  dialect: 'postgres',
  logging: NODE_ENV === 'development' ? console.log : false,
  define: {
    underscored: true, // snake_case columns in Postgres, camelCase in JS
    timestamps: true,
  },
});

module.exports = sequelize;
