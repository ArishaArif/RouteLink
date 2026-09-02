const { DataTypes } = require('sequelize');
const { numericGetter } = require('../utils/numeric');

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
      type: DataTypes.ENUM('requested', 'pending', 'confirmed', 'cancelled', 'completed'),
      allowNull: false,
      defaultValue: 'requested',
    },
    totalPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'total_price',
      get: numericGetter('totalPrice'),
    },
  }, {
    tableName: 'bookings',
  });

  return Booking;
};
