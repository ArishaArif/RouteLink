const { DataTypes } = require('sequelize');
const { DESTINATION_STATE_STATUSES } = require('../utils/destinationState');

module.exports = (sequelize) => {
  const UserDestinationState = sequelize.define('UserDestinationState', {
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
    destinationName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'destination_name',
    },
    status: {
      type: DataTypes.ENUM(...DESTINATION_STATE_STATUSES),
      allowNull: false,
    },
  }, {
    tableName: 'user_destination_states',
  });

  return UserDestinationState;
};
