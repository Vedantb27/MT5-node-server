// models/FetchedCtraderAccounts.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Users = require('./Users');

const FetchedCtraderAccounts = sequelize.define('FetchedCtraderAccounts', {
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
    accountId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        unique: true,
    },
    accountNumber: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    live: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
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
        allowNull: false,
    },
    traderRegistrationTimestamp: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    traderAccountType: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    leverage: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    leverageInCents: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    balance: {
        type: DataTypes.DOUBLE,
        allowNull: false,
    },
    deleted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
    },
    accountStatus: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    swapFree: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
    },
    moneyDigits: {
        type: DataTypes.INTEGER,
        allowNull: false,
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
FetchedCtraderAccounts.belongsTo(Users, { foreignKey: 'userId' });

module.exports = FetchedCtraderAccounts;
