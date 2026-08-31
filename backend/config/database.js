require('dotenv').config();
const { Sequelize } = require('sequelize');

const {
  DATABASE_URL,
  DB_HOST,
  DB_PORT,
  DB_NAME,
  DB_USER,
  DB_PASSWORD,
  NODE_ENV,
} = process.env;

const commonOptions = {
  dialect: 'postgres',
  logging: NODE_ENV === 'development' ? console.log : false,
  define: {
    underscored: true,
    timestamps: true,
  },
};

const sequelize = DATABASE_URL
  ? new Sequelize(DATABASE_URL, commonOptions)
  : new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
    ...commonOptions,
    host: DB_HOST,
    port: DB_PORT ? Number(DB_PORT) : 5432,
  });

module.exports = sequelize;
