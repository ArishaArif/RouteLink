// models/index.js
// Single entry point: loads every model, wires up associations, and
// exports { sequelize, Sequelize, User, Trip, Itinerary, Guide, Booking,
// HazardAlert }. Import models from here everywhere else in the app —
// never require an individual model file directly — so associations are
// always in effect.

const sequelize = require('../config/database');
const { Sequelize } = require('sequelize');

const User = require('./User')(sequelize);
const Trip = require('./Trip')(sequelize);
const Itinerary = require('./Itinerary')(sequelize);
const Guide = require('./Guide')(sequelize);
const Booking = require('./Booking')(sequelize);
const HazardAlert = require('./HazardAlert')(sequelize);

// ---- Associations ----

// User <-> Trip (a traveler's trips)
User.hasMany(Trip, { foreignKey: 'userId', as: 'trips', onDelete: 'CASCADE' });
Trip.belongsTo(User, { foreignKey: 'userId', as: 'traveler' });

// User <-> Guide (one guide profile per user with role "guide")
User.hasOne(Guide, { foreignKey: 'userId', as: 'guideProfile', onDelete: 'CASCADE' });
Guide.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Trip <-> Itinerary (one row per day)
Trip.hasMany(Itinerary, { foreignKey: 'tripId', as: 'itineraries', onDelete: 'CASCADE' });
Itinerary.belongsTo(Trip, { foreignKey: 'tripId', as: 'trip' });

// Booking links Trip, Guide, and User (the traveler booking the guide)
Trip.hasMany(Booking, { foreignKey: 'tripId', as: 'bookings', onDelete: 'CASCADE' });
Booking.belongsTo(Trip, { foreignKey: 'tripId', as: 'trip' });

Guide.hasMany(Booking, { foreignKey: 'guideId', as: 'bookings', onDelete: 'CASCADE' });
Booking.belongsTo(Guide, { foreignKey: 'guideId', as: 'guide' });

User.hasMany(Booking, { foreignKey: 'userId', as: 'bookings', onDelete: 'CASCADE' });
Booking.belongsTo(User, { foreignKey: 'userId', as: 'traveler' });

// HazardAlert is intentionally standalone — no FK associations. It's
// queried directly by region/location, not joined through Trip/User.

module.exports = {
  sequelize,
  Sequelize,
  User,
  Trip,
  Itinerary,
  Guide,
  Booking,
  HazardAlert,
};
