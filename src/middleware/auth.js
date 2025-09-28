const jwt = require('jsonwebtoken');
const Users = require('../models/Users'); // Adjust path to your Users model

const authMiddleware = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Token should be in the format: "Bearer <token>"
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Invalid token format' });
    }

    // Verify and decode the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.email) {
      return res.status(401).json({ error: 'Invalid token: Email not found' });
    }

    // Check if the user exists in the database
    const user = await Users.findOne({ where: { email: decoded.email } });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    // Attach user data to the request object
    req.user = {...decoded,firstName:user?.firstName};
    next(); // Proceed to the next middleware or route handler
  } catch (err) {
    console.error('Auth middleware error:', err);
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = authMiddleware;