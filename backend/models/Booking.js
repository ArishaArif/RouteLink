// models/Booking.js
// Links a Trip, a Guide, and the User making the booking (the traveler).
// Kept separate from Trip/Guide since one trip could have multiple guide
// bookings (different days/regions), and to allow booking-specific state.

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Booking = sequelize.define('Booking', {
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
    guideId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'guide_id',
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'confirmed', 'cancelled', 'completed'),
      allowNull: false,
      defaultValue: 'pending',
    },
    totalPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'total_price',
    },
  }, {
    tableName: 'bookings',
  });

  return Booking;
};
