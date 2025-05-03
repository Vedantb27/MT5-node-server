const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Users = require('./Users');
const MT5Accounts = require('./MT5Accounts');

const Trades = sequelize.define('Trades', {
    sr_no: { type: DataTypes.INTEGER, autoIncrement: true },
    mt5_account_number: { type: DataTypes.STRING, allowNull: false },
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

const calendarEvents = sequelize.define('calendarEvents',{
    sr_no: { type: DataTypes.INTEGER, autoIncrement: true ,unique:true},
    date: {type: DataTypes.DATEONLY, primaryKey:true, unique:true, allowNull:false },
    notes: { type: DataTypes.STRING, allowNull: false },
    color:{ type: DataTypes.STRING, allowNull: false }
})

module.exports = { Trades, calendarEvents, Users, MT5Accounts };
