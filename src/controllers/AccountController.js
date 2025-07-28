const axios = require('axios');
const { Accounts } = require('../models/Trades');
const FetchedCtraderAccounts = require('../models/FetchedCtraderAccounts');
const mt5Login = require('./tradeController').mt5Login;
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { getMyFxbookHistory } = require('./ChistoryController');
const { loginAccount } = require('./CauthController');



const getAccounts = async (req, res) => {
  try {
    const userId = req.user.id;
    const accounts = await Accounts?.findAll({
      where: { userId },
      attributes: ['accountNumber', 'server', 'platform', 'createdAt'],
    });
    return res.status(200).json(accounts);
  } catch (err) {
    console.error('Error fetching  accounts:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


const addAccount = async (req, res) => {
  const axios = require('axios');
  try {
    const userId = req.user.id;
    const { accountNumber, password, server, platform, code } = req.body;

    const existingAccounts = await Accounts.findAll({ where: { userId } });
    if (existingAccounts.length > 0) {
      return res.status(400).json({ message: 'Your current plan only supports one account' });
    }

    // Validate platform
    if (!['MT5', 'cTrader'].includes(platform)) {
      return res.status(400).json({ message: 'Invalid platform specified' });
    }

    // Validate input based on platform
    if (platform === 'MT5') {
      if (!accountNumber || !password || !server) {
        return res.status(400).json({ message: 'Account number, password, and server are required for MT5' });
      }

      // Validate MT5 credentials
      const loginResponse = await mt5Login({
        body: { account: accountNumber, password, server }
      }, { status: () => ({ json: () => { } }) });

      if (loginResponse.status !== 200) {
        return res.status(400).json({ message: 'Invalid MT5 credentials', details: loginResponse.error });
      }
    } else if (platform === 'cTrader') {
      if (!code) {
        return res.status(400).json({ message: 'Code is required for cTrader' });
      }
      if (!accountNumber) {
        return res.status(400).json({ message: 'Account number is required for cTrader' });
      }

      // Get access token from cTrader
      const tokenResponse = await axios.post('https://openapi.ctrader.com/apps/token', {
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.REDIRECT_URI,
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET
      }, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      const { accessToken, expiresIn, refreshToken } = tokenResponse.data;

      // Get trading accounts
      const accountsResponse = await axios.get(`https://api.spotware.com/connect/tradingaccounts?access_token=${accessToken}`);
      const tradingAccounts = accountsResponse.data.data;

      // Store accounts in FetchedCtraderAccounts
      for (const account of tradingAccounts) {
        const existingFetchedAccount = await FetchedCtraderAccounts.findOne({
          where: { accountNumber: account.accountNumber, userId }
        });

        if (!existingFetchedAccount) {
          await FetchedCtraderAccounts.create({
            userId,
            accountId: account.accountId,
            accountNumber: account.accountNumber,
            live: account.live,
            brokerName: account.brokerName,
            brokerTitle: account.brokerTitle,
            depositCurrency: account.depositCurrency,
            traderRegistrationTimestamp: account.traderRegistrationTimestamp,
            traderAccountType: account.traderAccountType,
            leverage: account.leverage,
            leverageInCents: account.leverageInCents,
            balance: account.balance,
            deleted: account.deleted,
            accountStatus: account.accountStatus,
            swapFree: account.swapFree,
            moneyDigits: account.moneyDigits,
            accessToken,
            refreshToken,
            expiresIn,
            lastRefreshedOn: new Date()
          });
        }
      }

      // Check if more than one account
      if (tradingAccounts.length > 1) {
        return res.status(400).json({
          message: 'Your current plan only supports one account'
        });
      }

      // For single account, proceed to save in Accounts table
      const selectedAccount = tradingAccounts[0];

      // Check if account already exists for the user
      const existingAccount = await Accounts.findOne({
        where: { accountNumber: selectedAccount.accountNumber, userId }
      });

      if (existingAccount) {
        return res.status(400).json({ message: 'Account number already exists for this user' });
      }

      // Create new account in Accounts table
      const newAccount = await Accounts.create({
        userId,
        accountNumber: selectedAccount.accountNumber,
        accountId: selectedAccount.accountId,
        live: selectedAccount.live,
        brokerName: selectedAccount.brokerName,
        brokerTitle: selectedAccount.brokerTitle,
        depositCurrency: selectedAccount.depositCurrency,
        traderRegistrationTimestamp: selectedAccount.traderRegistrationTimestamp,
        traderAccountType: selectedAccount.traderAccountType,
        leverage: selectedAccount.leverage,
        leverageInCents: selectedAccount.leverageInCents,
        balance: selectedAccount.balance,
        deleted: selectedAccount.deleted,
        accountStatus: selectedAccount.accountStatus,
        swapFree: selectedAccount.swapFree,
        moneyDigits: selectedAccount.moneyDigits,
        accessToken,
        refreshToken,
        expiresIn,
        lastRefreshedOn: new Date(),
        platform
      });

      if (newAccount) {
        const tableName = `${userId}_trades`;

        const tableExists = await sequelize.getQueryInterface().showAllTables()
          .then(tables => tables.includes(tableName));

        if (!tableExists) {

          const DynamicTrades = sequelize.define(tableName, {
            sr_no: { type: DataTypes.INTEGER, autoIncrement: true },
            accountId: { type: DataTypes.STRING, allowNull: false },
            accountNumber: {type: DataTypes.BIGINT,allowNull: false},
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

          const tableCreated = await DynamicTrades.sync();
        }

        const history = await getMyFxbookHistory(selectedAccount?.accountId, userId,accountNumber)
        if (!history.success) {
          const login = await loginAccount({ accessToken, ctidTraderAccountId: selectedAccount?.accountId })
          if (login?.success) {
            await getMyFxbookHistory(selectedAccount?.accountId, userId,accountNumber)
          }
        }

      }


      // Return the created account
      return res.status(201).json({
        status: 201,
        message: `${platform} Account added successfully`,
        id: newAccount.id,
        accountNumber: newAccount.accountNumber,
        platform: newAccount.platform,
        createdAt: newAccount.createdAt
      });
    }

    // Check if account already exists for the user (for MT5)
    const existingAccount = await Accounts.findOne({ where: { accountNumber, userId } });
    if (existingAccount) {
      return res.status(400).json({ message: 'Account number already exists for this user' });
    }

    // Create new account (for MT5)
    const newAccount = await Accounts.create({
      userId,
      accountNumber,
      password,
      server,
      platform
    });

    // Return the created account
    return res.status(201).json({
      status: 201,
      message: `${platform} Account added successfully`,
      id: newAccount.id,
      accountNumber: newAccount.accountNumber,
      platform: newAccount.platform,
      createdAt: newAccount.createdAt
    });
  } catch (err) {
    console.error(`Error adding account:`, err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getAccounts,
  addAccount,
};