const { DataTypes } = require('sequelize');
const { HEAT_TIERS, SLOT_TYPES, ITINERARY_SOURCES } = require('../utils/itineraryContract');

module.exports = (sequelize) => {
  const Itinerary = sequelize.define('Itinerary', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    tripId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'trip_id',
    },
    dayNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    activities: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    weatherContext: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'weather_context',
    },
    hazardContext: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'hazard_context',
    },
    slotType: {
      type: DataTypes.ENUM(...SLOT_TYPES),
      allowNull: true,
      field: 'slot_type',
    },
    heatTier: {
      type: DataTypes.ENUM(...HEAT_TIERS),
      allowNull: true,
      field: 'heat_tier',
    },
    needsMarketplaceData: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'needs_marketplace_data',
    },
    fallbackMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'fallback_message',
    },
    source: {
      type: DataTypes.ENUM(...ITINERARY_SOURCES),
      allowNull: false,
      defaultValue: 'ml',
    },
    modelVersion: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'model_version',
    },
  }, {
    tableName: 'itineraries',
    indexes: [
      { unique: true, fields: ['trip_id', 'day_number'] },
    ],
  });

  return Itinerary;
};
