const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Guide = sequelize.define('Guide', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      field: 'user_id',
    },
    region: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    languages: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    pricePerDay: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'price_per_day',
    },
    rating: {
      type: DataTypes.DECIMAL(2, 1),
      allowNull: false,
      defaultValue: 0,
    },
    isAvailable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  }, {
    tableName: 'guides',
  });

  return Guide;
};
