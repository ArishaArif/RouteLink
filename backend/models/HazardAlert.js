// models/HazardAlert.js
// Region-based safety/hazard alerts fed by an NLP pipeline (e.g. scraping
// news/advisories and classifying them). Deliberately NOT tied to a
// specific trip or user — it's queried by region/location so any trip
// whose destination matches gets warned. `source` records what fed it in
// (useful while the NLP pipeline is still being iterated on).

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const HazardAlert = sequelize.define('HazardAlert', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    region: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // Optional finer-grained coordinates, if the NLP pipeline can resolve them.
    latitude: {
      type: DataTypes.DECIMAL(9, 6),
      allowNull: true,
    },
    longitude: {
      type: DataTypes.DECIMAL(9, 6),
      allowNull: true,
    },
    category: {
      type: DataTypes.ENUM('weather', 'health', 'safety', 'political', 'natural_disaster', 'other'),
      allowNull: false,
      defaultValue: 'other',
    },
    severity: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
      allowNull: false,
      defaultValue: 'low',
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    source: {
      // e.g. "nlp_pipeline_v1", "manual", name of feed ingested
      type: DataTypes.STRING,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'expires_at',
    },
  }, {
    tableName: 'hazard_alerts',
    indexes: [
      { fields: ['region'] },
      { fields: ['is_active'] },
    ],
  });

  return HazardAlert;
};
