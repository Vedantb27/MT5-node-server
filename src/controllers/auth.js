const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Users } = require('../models/Trades');
const { OAuth2Client } = require('google-auth-library');
const axios = require('axios');
const Accounts = require('../models/Accounts');

const signup = async (req, res) => {
  try {
    const { firstName, lastName, email, password, googleId } = req.body;

    // Validation
    if (!firstName || !lastName || !email || (!password && !googleId)) {
      return res.status(400).json({ error: 'First name, last name, email, and either password or Google ID are required' });
    }

    // Check if user already exists
    const existingUser = await Users.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    let hashedPassword = null;
    if (password) {
      // Hash password for regular signup
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // Create user
    const user = await Users.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      googleId: googleId || null,
    });

    res.status(201).json({
      message: 'User created successfully',
      user: {firstName, lastName, email },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Internal server error',
      details: err.message,
    });
  }
};

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require('./tradeauth-81fcd-firebase-adminsdk-fbsvc-f823921d87.json')),
  });
}

async function verifyGoogleToken(idToken) {
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (err) {
    console.error('Firebase token verification error:', err);
    throw new Error(`Firebase token verification failed: ${err.message}`);
  }
}

const login = async (req, res) => {
  try {
    const { email, password, googleIdToken } = req.body;

    // Validate input
    if (!email || (!password && !googleIdToken)) {
      return res.status(400).json({ error: 'Email and either password or Google ID token are required' });
    }

    // Find user by email
    const user = await Users.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (googleIdToken) {
      // Firebase/Google login
      try {
        console.log('Verifying Firebase ID Token');
        console.log('Received Google ID Token:', googleIdToken);

        const payload = await verifyGoogleToken(googleIdToken);
        console.log('Verified Token Payload:', payload);

        // For Firebase tokens, `sub` is the Firebase UID, and `email` should match
        if (payload.email !== email || payload.sub !== user.googleId) {
          return res.status(401).json({ error: 'Invalid Google credentials' });
        }
      } catch (err) {
        console.error('Google token verification error:', err);
        return res.status(401).json({ error: `Google token verification failed: ${err.message}` });
      }
    } else {
      // Normal login
      if (!user.password) {
        return res.status(401).json({ error: 'Account linked with Google. Please use Google login.' });
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
    }
   
 
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {firstName: user.firstName, lastName: user.lastName, email: user.email },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { signup, login };