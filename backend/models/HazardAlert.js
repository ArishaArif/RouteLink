const { DataTypes } = require('sequelize');
const { numericGetter } = require('../utils/numeric');

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
    latitude: {
      type: DataTypes.DECIMAL(9, 6),
      allowNull: true,
      get: numericGetter('latitude'),
    },
    longitude: {
      type: DataTypes.DECIMAL(9, 6),
      allowNull: true,
      get: numericGetter('longitude'),
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
      type: DataTypes.STRING,
      allowNull: true,
    },
    sourceType: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'source_type',
    },
    rawText: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'raw_text',
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
    dedupeHash: {
      type: DataTypes.STRING(64),
      allowNull: true,
      field: 'dedupe_hash',
    },
  }, {
    tableName: 'hazard_alerts',
    indexes: [
      { fields: ['region'] },
      { fields: ['is_active'] },
      { unique: true, fields: ['dedupe_hash'] },
    ],
  });

  return HazardAlert;
};
