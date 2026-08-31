const { DataTypes } = require('sequelize');

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
  }, {
    tableName: 'itineraries',
    indexes: [
      { unique: true, fields: ['trip_id', 'day_number'] },
    ],
  });

  return Itinerary;
};
