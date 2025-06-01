const axios = require('axios');
const { Trades, MT5Accounts } = require('../models/Trades');
const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

const fetchTrades = async (req, res) => {
  try {
    const { start_date, end_date } = req.body;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }


    const response = await axios.get(`${process.env.MT5_URL}/trading-history`, {
      params: { start_date, end_date }
    });

    const tradeData = response.data.completed_trades;

    if (!tradeData || !Array.isArray(tradeData)) {
      return res.status(400).json({ error: 'Invalid trade data received' });
    }

    // Use Promise.all for parallel processing of trades
    await Promise.all(tradeData.map(trade =>
      Trades.create({
        position_id: trade.position_id,
        open_date: trade.opening_date,
        open_time: trade.opening_time,
        close_date: trade.closing_date,
        close_time: trade.closing_time,
        trade_duration: trade.duration_formatted,
        trade_duration_seconds: trade.duration_seconds,
        open_price: trade.open_price,
        close_price: trade.close_price,
        no_of_deals: trade.deals?.length || 0,
        profit: trade.profit,
        sl_price: trade.sl_price ? parseFloat(trade.sl_price) : null,
        tp_price: trade.tp_price ? parseFloat(trade.tp_price) : null,
        type: trade.type,
        symbol: trade.symbol,
        volume: trade.volume,
        history_from_date: start_date,
        history_to_date: end_date
      })
    ));

    return res.status(200).json({ message: 'Trade history stored successfully' });
  } catch (err) {
    console.error('Error fetching or storing trade history:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


const getTradeHistory = async (req, res) => {
  try {
    const userid = req.user?.id;
    const { mt5AccountNumber: mt5accountnumber } = req.query;

    if (!mt5accountnumber) {
      return res.status(400).json({ error: 'MT5 account number is required' });
    }

    const mt5Account = await MT5Accounts.findOne({
      where: {
        userId: userid,
        accountNumber: mt5accountnumber,
      },
    });

    if (!mt5Account) {
      return res.status(403).json({ error: 'Invalid MT5 account number for this user' });
    }

    const tableName = `${userid}_trades`;

    const DynamicTrades = sequelize.define(tableName, {
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
      history_from_date: { type: DataTypes.DATEONLY, allowNull: false },
      history_to_date: { type: DataTypes.DATEONLY, allowNull: false },
    }, {
      tableName,
      timestamps: false,
    });

    const trades = await DynamicTrades.findAll({
      where: {
        mt5_account_number: mt5accountnumber,
      },
    });

    return res.status(200).json(trades);
  } catch (err) {
    console.error('Error fetching trade history:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


const mt5Login = async (req, res) => {
  try {
    const { account, password, server } = req.body;

    if (!account || !password || !server) {
      return { status: 400, error: 'Account, password, and server are required' };
    }

    const response = await axios.post(`${process.env.MT5_URL}/mt5-login`, {
      account,
      password,
      server,
    });

    const mt5Data = response.data;

    if (!mt5Data.success) {
      return { status: 400, error: 'MT5 login failed', details: mt5Data.error };
    }

    return {
      status: 200,
      success: true,
      message: 'MT5 login successful',
      account_info: mt5Data.account_info,
    };
  } catch (err) {
    console.error('Error during MT5 login:', err);
    return { status: 500, error: 'Internal server error' };
  }
};
module.exports = {
  fetchTrades,
  getTradeHistory,
  mt5Login
};