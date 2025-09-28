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
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  accountId: {
    type: DataTypes.BIGINT,
    allowNull: true,
    // unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  server: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  live: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  brokerName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  brokerTitle: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  depositCurrency: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  traderRegistrationTimestamp: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  traderAccountType: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  leverage: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  leverageInCents: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  platform: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  balance: {
    type: DataTypes.DOUBLE,
    allowNull: true,
  },
  deleted: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  accountStatus: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  swapFree: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  moneyDigits: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  accessToken: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  refreshToken: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  expiresIn: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  lastRefreshedOn: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,
  },
  FetchedHistoryTill: {
    type: DataTypes.DATE,
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