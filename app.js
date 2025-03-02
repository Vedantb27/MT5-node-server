const express = require('express');
const sequelize = require('./src/config/database');
const tradeRoutes = require('./src/routes/tradeRoutes');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());

// Sync database
sequelize.sync()
    .then(() => console.log('Database synced'))
    .catch(err => console.error('Error syncing database:', err));

// Routes
app.use('/api', tradeRoutes);

app.get('/', (req, res) => {
    res.send('Hello server');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
