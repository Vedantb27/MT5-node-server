const axios = require('axios');
const { Trades, Accounts } = require('../models/Trades');
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

  
   
    return res.status(200).json({tradeData, message: 'Trade history stored successfully' });
  } catch (err) {
    console.error('Error fetching or storing trade history:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


const getTradeHistory = async (req, res) => {
  try {
    const userid = req.user?.id;
    const { accountNumber: accountNumber } = req.query;

    if (!accountNumber) {
      return res.status(400).json({ error: 'Account number is required' });
    }

    const Account = await Accounts.findOne({
      where: {
        userId: userid,
        accountNumber: accountNumber,
      },
    });

    if (!Account) {
      return res.status(403).json({ error: 'Invalid Account number for this user' });
    }

    const tableName = `${userid}_trades`;

    const DynamicTrades = sequelize.define(tableName, {
      sr_no: { type: DataTypes.INTEGER, autoIncrement: true },
      accountNumber: { type: DataTypes.STRING, allowNull: false },
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
    accountNumber: accountNumber,
  },
  order: [
    ['close_date', 'DESC'],
    ['close_time', 'DESC']
  ]
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