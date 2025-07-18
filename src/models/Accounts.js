// models/Accounts.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Users = require('./Users');

const Accounts = sequelize.define('Accounts', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Users,
      key: 'id',
    },
  },
  accountNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  server: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  platform: {
    type: DataTypes.STRING,
    allowNull: false,
    
  },
  oauthToken: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
});

// Define associations
Accounts.belongsTo(Users, { foreignKey: 'userId' });

module.exports = Accounts;