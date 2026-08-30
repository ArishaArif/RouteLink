// models/Itinerary.js
// One row per day of a Trip. `activities` holds that day's planned activity
// list; `weatherContext` snapshots the weather data used to schedule/adjust
// that day's plan (e.g. from a weather API at planning time).

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
      // e.g. [{ time: "09:00", title: "City walking tour", location: "...", notes: "..." }]
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    weatherContext: {
      // e.g. { forecast: "rain", tempC: 18, source: "openweather", fetchedAt: "..." }
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
