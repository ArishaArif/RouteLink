// models/User.js
// A traveler or guide account. `preferences` is a free-form JSON field that
// the AI/ML recommendation engine reads from (e.g. interests, budget band,
// travel pace, past destination types). Backend just stores/returns it —
// shape is owned jointly with the ML team.

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    password: {
      type: DataTypes.STRING, // bcrypt hash, never plaintext
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('traveler', 'guide', 'admin'),
      allowNull: false,
      defaultValue: 'traveler',
    },
    preferences: {
      // Read by the ML recommendation engine. e.g.
      // { interests: ["hiking","food"], budgetLevel: "mid", pace: "relaxed" }
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  }, {
    tableName: 'users',
  });

  return User;
};
