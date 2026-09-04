const sequelize = require('../config/database');
const { Sequelize } = require('sequelize');

const User = require('./User')(sequelize);
const Trip = require('./Trip')(sequelize);
const Itinerary = require('./Itinerary')(sequelize);
const Guide = require('./Guide')(sequelize);
const Booking = require('./Booking')(sequelize);
const HazardAlert = require('./HazardAlert')(sequelize);
const ChatMessage = require('./ChatMessage')(sequelize);
const UserDestinationState = require('./UserDestinationState')(sequelize);

User.hasMany(Trip, { foreignKey: 'userId', as: 'trips', onDelete: 'CASCADE' });
Trip.belongsTo(User, { foreignKey: 'userId', as: 'traveler' });

User.hasOne(Guide, { foreignKey: 'userId', as: 'guideProfile', onDelete: 'CASCADE' });
Guide.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Trip.hasMany(Itinerary, { foreignKey: 'tripId', as: 'itineraries', onDelete: 'CASCADE' });
Itinerary.belongsTo(Trip, { foreignKey: 'tripId', as: 'trip' });

Trip.hasMany(Booking, { foreignKey: 'tripId', as: 'bookings', onDelete: 'CASCADE' });
Booking.belongsTo(Trip, { foreignKey: 'tripId', as: 'trip' });

Guide.hasMany(Booking, { foreignKey: 'guideId', as: 'bookings', onDelete: 'CASCADE' });
Booking.belongsTo(Guide, { foreignKey: 'guideId', as: 'guide' });

User.hasMany(Booking, { foreignKey: 'userId', as: 'bookings', onDelete: 'CASCADE' });
Booking.belongsTo(User, { foreignKey: 'userId', as: 'traveler' });

Booking.hasMany(ChatMessage, { foreignKey: 'bookingId', as: 'messages', onDelete: 'CASCADE' });
ChatMessage.belongsTo(Booking, { foreignKey: 'bookingId', as: 'booking' });

User.hasMany(ChatMessage, { foreignKey: 'senderId', as: 'sentMessages', onDelete: 'CASCADE' });
ChatMessage.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });

User.hasMany(UserDestinationState, { foreignKey: 'userId', as: 'destinationStates', onDelete: 'CASCADE' });
UserDestinationState.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = {
  sequelize,
  Sequelize,
  User,
  Trip,
  Itinerary,
  Guide,
  Booking,
  HazardAlert,
  ChatMessage,
  UserDestinationState,
};
