const axios = require('axios');
const { MT5Accounts } = require('../models/Trades');
const mt5Login = require('./tradeController').mt5Login; // Import mt5Login from tradeController

// Fetch all MT5 accounts for the authenticated user
const getMT5Accounts = async (req, res) => {  
  try {
    const userId = req.user.id; // From authMiddleware
    const accounts = await MT5Accounts?.findAll({
      where: { userId },
      attributes: [ 'accountNumber', 'server', 'platform', 'createdAt'],
    });
    return res.status(200).json(accounts);
  } catch (err) {
    console.error('Error fetching MT5 accounts:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Add a new MT5 account with validation
const addMT5Account = async (req, res) => {
  try {
    const userId = req.user.id; // From authMiddleware
    const { accountNumber, password, server, platform } = req.body;

    // Validate input
    if (!accountNumber || !password || !server) {
      return res.status(400).json({ error: 'Account number, password, and server are required' });
    }

    // Validate credentials using mt5Login
    const loginResponse = await mt5Login({ body: { account: accountNumber, password, server } }, { status: () => ({ json: () => {} }) });
    if (loginResponse.status !== 200) {
      return res.status(400).json({ error: 'Invalid MT5 credentials', details: loginResponse.error });
    }

    // Check if account already exists for the user
    const existingAccount = await MT5Accounts.findOne({ where: { accountNumber, userId } });
    if (existingAccount) {
      return res.status(400).json({ error: 'Account number already exists for this user' });
    }

    // Create new MT5 account
    const newAccount = await MT5Accounts.create({
      userId,
      accountNumber,
      password, // Store securely (consider encryption in production)
      server,
      platform:'MT5',
    });

    // Return the created account (excluding password)
    return res.status(201).json({
      id: newAccount.id,
      accountNumber: newAccount.accountNumber,
      server: newAccount.server,
      platform: newAccount.platform,
      createdAt: newAccount.createdAt,
    });
  } catch (err) {
    console.error('Error adding MT5 account:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getMT5Accounts,
  addMT5Account,
};