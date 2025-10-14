const axios = require('axios');
const { Accounts } = require('../models/Trades');
const FetchedCtraderAccounts = require('../models/FetchedCtraderAccounts');
const { mt5Login, fetchTrades } = require('./tradeController');
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { getMyFxbookHistory } = require('./ChistoryController');
const { loginAccount } = require('./CauthController');
const RequestedServer = require('../models/RequestedServer');

const getAccounts = async (req, res) => {
  try {
    const userId = req.user.id;
    const accounts = await Accounts?.findAll({
      where: { userId },
      attributes: ['accountNumber', 'server', 'platform', 'balance', 'depositCurrency', 'createdAt'],
    });
    return res.status(200).json(accounts);
  } catch (err) {
    console.error('Error fetching  accounts:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const addAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const { accountNumber, password, server, platform, code } = req.body;
    console.log('addAccount APi accountNumber:', accountNumber);
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
        body: { account: parseInt(accountNumber), password, server }
      }, { status: () => ({ json: () => { } }) });

      if (loginResponse.status !== 200) {
        return res.status(400).json({ message: 'Invalid MT5 credentials', details: loginResponse.error });
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
        platform,
        balance: loginResponse.account_info?.initial_balance,
        depositCurrency: loginResponse.account_info?.currency,
        FetchedHistoryTill: new Date()
      });

      if (newAccount) {
        const tableName = `${userId}_trades`;

        const tableExists = await sequelize.getQueryInterface().showAllTables()
          .then(tables => tables.includes(tableName));

        if (!tableExists) {

          const DynamicTrades = sequelize.define(tableName, {
            sr_no: { type: DataTypes.INTEGER, autoIncrement: true },
            accountId: { type: DataTypes.STRING, allowNull: false },
            accountNumber: { type: DataTypes.BIGINT, allowNull: false },
            position_id: { type: DataTypes.INTEGER, primaryKey: true, unique: true, allowNull: false },
            open_date: { type: DataTypes.DATEONLY, allowNull: false },
            open_time: { type: DataTypes.TIME, allowNull: false },
            close_date: { type: DataTypes.DATEONLY, allowNull: false },
            close_time: { type: DataTypes.TIME, allowNull: false },
            trade_duration: { type: DataTypes.STRING, allowNull: false },
            trade_duration_seconds: { type: DataTypes.STRING, allowNull: false },
            open_price: { type: DataTypes.FLOAT, allowNull: false },
            swap: { type: DataTypes.FLOAT, allowNull: false },
            commission: { type: DataTypes.FLOAT, allowNull: false },
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
          }, {
            tableName,
            timestamps: false,
          });

          await DynamicTrades.sync();
        }

        // Fetch MT5 history using fetchTrades
        const start_date = '1970-01-01';
        const end_date = new Date().toISOString().split('T')[0];
        const mockReq = { body: { start_date, end_date } };
        let mockRes = {
          _status: null,
          _data: null,
          status: function (code) {
            this._status = code;
            return this;
          },
          json: function (data) {
            this._data = data;
            return this;
          }
        };

        await fetchTrades(mockReq, mockRes);

        if (mockRes._status === 200 && mockRes._data && mockRes._data.tradeData) {
          const tradeData = mockRes._data.tradeData;
          if (Array.isArray(tradeData)) {
            const DynamicTrades = sequelize.define(tableName, {
              sr_no: { type: DataTypes.INTEGER, autoIncrement: true },
              accountId: { type: DataTypes.STRING, allowNull: false },
              accountNumber: { type: DataTypes.BIGINT, allowNull: false },
              position_id: { type: DataTypes.INTEGER, primaryKey: true, unique: true, allowNull: false },
              open_date: { type: DataTypes.DATEONLY, allowNull: false },
              open_time: { type: DataTypes.TIME, allowNull: false },
              close_date: { type: DataTypes.DATEONLY, allowNull: false },
              close_time: { type: DataTypes.TIME, allowNull: false },
              swap: { type: DataTypes.FLOAT, allowNull: false },
              commission: { type: DataTypes.FLOAT, allowNull: false },
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
            }, {
              tableName,
              timestamps: false,
            });

            for (const trade of tradeData) {
              const openParts = trade.opening_time.split(' ');
              const closeParts = trade.closing_time.split(' ');
              const sl = trade.sl_price ? parseFloat(trade.sl_price) : null;
              const tp = trade.tp_price ? parseFloat(trade.tp_price) : null;

              await DynamicTrades.upsert({
                accountId: accountNumber.toString(),
                accountNumber: accountNumber,
                position_id: trade.position_id,
                open_date: openParts[0],
                open_time: openParts[1],
                close_date: closeParts[0],
                close_time: closeParts[1],
                trade_duration: trade.duration_formatted,
                trade_duration_seconds: trade.duration_seconds.toString(),
                open_price: trade.open_price,
                close_price: trade.close_price,
                commission: trade.commission,
                swap: trade.swap,
                no_of_deals: trade.deals.length,
                profit: Math.trunc((trade.profit + (trade.commission) + (trade.swap)) * 100) / 100,
                sl_price: sl,
                tp_price: tp,
                type: trade.type,
                symbol: trade.symbol,
                volume: trade.volume,
                history_from_date: start_date,
                history_to_date: end_date,
              });
            }

            // Calculate initial balance
            let sum_profit = await DynamicTrades.sum('profit', { where: { accountNumber: accountNumber } });
            if (sum_profit === null) sum_profit = 0;
            let sum_swap = await DynamicTrades.sum('swap', { where: { accountNumber: accountNumber } });
            if (sum_swap === null) sum_swap = 0;
            let sum_commission = await DynamicTrades.sum('commission', { where: { accountNumber: accountNumber } });
            if (sum_commission === null) sum_commission = 0;
          
            
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
            accountNumber: { type: DataTypes.BIGINT, allowNull: false },
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
            swap: { type: DataTypes.FLOAT, allowNull: false },
            commission: { type: DataTypes.FLOAT, allowNull: false },
            type: { type: DataTypes.STRING, allowNull: false },
            symbol: { type: DataTypes.STRING, allowNull: false },
            volume: { type: DataTypes.FLOAT, allowNull: false },
            history_from_date: { type: DataTypes.DATEONLY, allowNull: false },
            history_to_date: { type: DataTypes.DATEONLY, allowNull: false },
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
          }, {
            tableName,
            timestamps: false,
          });

          const tableCreated = await DynamicTrades.sync();
        }

        const history = await getMyFxbookHistory(selectedAccount?.accountId, userId, selectedAccount?.accountNumber)
        if (!history.success) {
          const login = await loginAccount({ accessToken, ctidTraderAccountId: selectedAccount?.accountId })
          if (login?.success) {
            await getMyFxbookHistory(selectedAccount?.accountId, userId, selectedAccount?.accountNumber)
          }
        }

        // Define DynamicTrades for sum calculation
        const DynamicTrades = sequelize.define(tableName, {
          sr_no: { type: DataTypes.INTEGER, autoIncrement: true },
          accountId: { type: DataTypes.STRING, allowNull: false },
          accountNumber: { type: DataTypes.BIGINT, allowNull: false },
          position_id: { type: DataTypes.INTEGER, primaryKey: true, unique: true, allowNull: false },
          open_date: { type: DataTypes.DATEONLY, allowNull: false },
          open_time: { type: DataTypes.TIME, allowNull: false },
          close_date: { type: DataTypes.DATEONLY, allowNull: false },
          close_time: { type: DataTypes.TIME, allowNull: false },
          trade_duration: { type: DataTypes.STRING, allowNull: false },
          trade_duration_seconds: { type: DataTypes.STRING, allowNull: false },
          open_price: { type: DataTypes.FLOAT, allowNull: false },
          close_price: { type: DataTypes.FLOAT, allowNull: false },
          swap: { type: DataTypes.FLOAT, allowNull: false },
          commission: { type: DataTypes.FLOAT, allowNull: false },
          no_of_deals: { type: DataTypes.FLOAT, allowNull: false },
          profit: { type: DataTypes.FLOAT, allowNull: false },
          sl_price: { type: DataTypes.FLOAT, allowNull: true },
          tp_price: { type: DataTypes.FLOAT, allowNull: true },
          type: { type: DataTypes.STRING, allowNull: false },
          symbol: { type: DataTypes.STRING, allowNull: false },
          volume: { type: DataTypes.FLOAT, allowNull: false },
          history_from_date: { type: DataTypes.DATEONLY, allowNull: false },
          history_to_date: { type: DataTypes.DATEONLY, allowNull: false },
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
        }, {
          tableName,
          timestamps: false,
        });

        // Calculate initial balance
        let sum_profit = await DynamicTrades.sum('profit', { where: { accountNumber: selectedAccount.accountNumber } });
        if (sum_profit === null) sum_profit = 0;
        const initial_balance = (selectedAccount.balance / 100) - sum_profit;
        await newAccount.update({ balance: initial_balance, FetchedHistoryTill: new Date() });
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
  } catch (err) {
    console.error(`Error adding account:`, err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};


const requestServer = async (req, res) => {
  try {
    console.log(req.user, "req.user")
    const userId = req.user.id;
    const userName = req.user.firstName;
    const { serverName } = req.body;


    if (!serverName) {
      return res.status(400).json({ message: 'Server name is required' });
    }


    const existingRequest = await RequestedServer.findOne({
      where: { serverName }
    });

    if (existingRequest) {
      return res.status(201).json({
        status: 201,
        message: 'Server request submitted successfully',
        serverName: serverName,
      });
    }
    else {
      const newServerRequest = await RequestedServer.create({
        userId,
        serverName,
        userName,
        added: false
      });
      return res.status(201).json({
        status: 201,
        message: 'Server request submitted successfully',
        serverName: serverName,
      });
    }

  } catch (err) {
    console.error('Error requesting server:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getAccounts,
  addAccount,
  requestServer
};