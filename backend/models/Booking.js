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
