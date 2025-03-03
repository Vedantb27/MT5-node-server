const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Trades = sequelize.define('Trades', {
    
    sr_no: { type: DataTypes.INTEGER, autoIncrement: true },
    position_id: { type: DataTypes.INTEGER, primaryKey: true, unique: true, allowNull: false },
    open_date: { type: DataTypes.DATEONLY, allowNull: false },
    open_time: { type: DataTypes.TIME, allowNull: false },
    close_date: { type: DataTypes.DATEONLY, allowNull: false },
    close_time: { type: DataTypes.TIME, allowNull: false },
    trade_duration: { type: DataTypes.STRING, allowNull: false },
    trade_duration_seconds: { type: DataTypes.STRING, allowNull: false },
    open_price: { type: DataTypes.FLOAT, allowNull: false },
    close_price: { type: DataTypes.FLOAT, allowNull: false },
    no_of_deals: { type: DataTypes.FLOAT, allowNull: false },
    profit: { type: DataTypes.FLOAT, allowNull: false },
    sl_price: { type: DataTypes.FLOAT, allowNull: true },
    tp_price: { type: DataTypes.FLOAT, allowNull: true },
    type: { type: DataTypes.STRING, allowNull: false },
    symbol: { type: DataTypes.STRING, allowNull: false },
    volume: { type: DataTypes.FLOAT, allowNull: false },
    history_from_date: {type: DataTypes.DATEONLY,allowNull: false},
    history_to_date: {type: DataTypes.DATEONLY,allowNull: false}

});

module.exports = Trades;
