const axios = require('axios');
const { Accounts } = require('../models/Trades');
const mt5Login = require('./tradeController').mt5Login; 


const getAccounts = async (req, res) => {  
  try {
    const userId = req.user.id; 
    const accounts = await Accounts?.findAll({
      where: { userId },
      attributes: [ 'accountNumber', 'server', 'platform', 'createdAt'],
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
    const { accountNumber, password, server, platform, oauthToken } = req.body;

    // Validate platform
    if (!['MT5', 'cTrader'].includes(platform)) {
      return res.status(400).json({ error: 'Invalid platform specified' });
    }

    // Validate input based on platform
    if (platform === 'MT5') {
      if (!accountNumber || !password || !server) {
        return res.status(400).json({ error: 'Account number, password, and server are required for MT5' });
      }

      // Validate MT5 credentials
      const loginResponse = await mt5Login({ 
        body: { account: accountNumber, password, server } 
      }, { status: () => ({ json: () => {} }) });
      
      if (loginResponse.status !== 200) {
        return res.status(400).json({ error: 'Invalid MT5 credentials', details: loginResponse.error });
      }
    } else if (platform === 'cTrader') {
      if (!oauthToken) {
        return res.status(400).json({ error: 'OAuth token is required for cTrader' });
      }
      // Use the provided accountNumber for cTrader or maintain as is
      if (!accountNumber) {
        return res.status(400).json({ error: 'Account number is required for cTrader' });
      }
    }

    // Check if account already exists for the user
    const existingAccount = await Accounts.findOne({ where: { accountNumber, userId } });
    if (existingAccount) {
      return res.status(400).json({ error: 'Account number already exists for this user' });
    }

    // Create new account
    const newAccount = await Accounts.create({
      userId,
      accountNumber,
      ...(platform === 'MT5' && { password, server }),
      ...(platform === 'cTrader' && { oauthToken }),
      platform,
    });

    // Return the created account
    return res.status(201).json({
      status: 201,
      message: `${platform} Account added successfully`,
      id: newAccount.id,
      accountNumber: newAccount.accountNumber,
      ...(platform === 'MT5' && { server: newAccount.server }),
      platform: newAccount.platform,
      createdAt: newAccount.createdAt,
      ...(platform === 'cTrader' && { oauthToken: newAccount.oauthToken }),
    });
  } catch (err) {
    console.error(`Error adding ${platform} account:`, err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getAccounts,
  addAccount,
};