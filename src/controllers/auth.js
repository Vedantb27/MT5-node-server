// controllers/auth.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Users } = require('../models/Trades');
const { OAuth2Client } = require('google-auth-library');
const axios = require('axios');

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

        // Generate JWT
        const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
            expiresIn: '1h',
        });

        res.status(201).json({
            message: 'User created successfully',
            token,
            user: { id: user.id, firstName, lastName, email },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: 'Internal server error',
            details: err.message,
        });
    }
};

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function verifyGoogleToken(idToken) {
    try {
      // Fetch Google's public keys
      const response = await axios.get('https://www.googleapis.com/oauth2/v3/certs');
      const keys = response.data.keys;
      console.log('Google Public Keys:', JSON.stringify(keys, null, 2));
  
      // Decode the token to get the kid
      const decoded = jwt.decode(idToken, { complete: true });
      if (!decoded) throw new Error('Invalid token format');
      console.log('Decoded Token Header:', decoded.header);
      console.log('Decoded Token Payload:', decoded.payload);
  
      // Find the matching key
      const key = keys.find(k => k.kid === decoded.header.kid);
      if (!key) throw new Error(`No public key found for kid: ${decoded.header.kid}`);
  
      // Convert x5c to PEM format
      const cert = `-----BEGIN CERTIFICATE-----\n${key.x5c[0]}\n-----END CERTIFICATE-----`;
  
      // Verify the token
      const payload = jwt.verify(idToken, cert, {
        algorithms: ['RS256'],
        audience: process.env.GOOGLE_CLIENT_ID,
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
      });
  
      return payload;
    } catch (err) {
      console.error('Manual token verification error:', err);
      throw new Error(`Manual token verification failed: ${err.message}`);
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
        // Google login
        try {
          if (!process.env.GOOGLE_CLIENT_ID) {
            throw new Error('GOOGLE_CLIENT_ID is not set in environment variables');
          }
          console.log('Verifying Google ID Token with Client ID:', process.env.GOOGLE_CLIENT_ID);
          console.log('Received Google ID Token:', googleIdToken);
  
          // Use manual verification
          const payload = await verifyGoogleToken(googleIdToken);
          console.log('Verified Google Token Payload:', payload);
  
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
  
      // Generate JWT
      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
  
      res.status(200).json({
        message: 'Login successful',
        token,
        user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email },
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };


// Export both signup (from previous) and login
module.exports = { signup, login };