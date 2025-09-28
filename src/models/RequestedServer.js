const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Users = require('./Users');

const RequestedServer = sequelize.define('RequestedServer', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  serverName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Users,
      key: 'id',
    },
  },
  userName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  added: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
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
RequestedServer.belongsTo(Users, { foreignKey: 'userId' });

module.exports = RequestedServer;