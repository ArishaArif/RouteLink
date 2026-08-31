const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Trip = sequelize.define('Trip', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    destination: {
      type: DataTypes.STRING,
      allowNull: false,
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
      type: DataTypes.ENUM('planning', 'upcoming', 'ongoing', 'completed', 'cancelled'),
      allowNull: false,
      defaultValue: 'planning',
    },
    budget: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
  }, {
    tableName: 'trips',
  });

  return Trip;
};
