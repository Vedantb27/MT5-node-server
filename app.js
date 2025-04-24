const express = require('express');
require('dotenv').config();
const sequelize = require('./src/config/database');
const tradeRoutes = require('./src/routes/tradeRoutes');
const cors = require('cors');
const app = express();
const PORT = 5000;
const authRoutes = require('./src/routes/auth');

// Middleware
app.use(express.json());

// CORS
app.use(cors());

// Sync database
sequelize.sync()
    .then(() => console.log('Database synced'))
    .catch(err => console.error('Error syncing database:', err));

// Routes
app.use('/api', tradeRoutes);
app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
    res.send('Hello server');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
