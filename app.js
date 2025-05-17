const express = require('express');
require('dotenv').config();
const sequelize = require('./src/config/database');
const tradeRoutes = require('./src/routes/tradeRoutes');
const cors = require('cors');
const authRoutes = require('./src/routes/auth');
const os = require('os');
const cluster = require('cluster');

const totalCpus = os.cpus().length;
const PORT = 8000;

if (cluster.isMaster) {
    console.log(`Master process ${process.pid} is running`);
    console.log(`Forking ${totalCpus} workers...`);

    // Fork workers
    for (let i = 0; i < totalCpus; i++) {
        cluster.fork();
    }

    // Listen for dying workers and optionally fork a new one
    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died. Spawning a new one...`);
        cluster.fork();
    });
} else {
    const app = express();

    // Middleware
    app.use(express.json());

    // CORS
    app.use(cors());

    // Sync database (only once, in master or single worker)
    if (cluster.worker.id === 1) {
        sequelize.sync()
            .then(() => console.log('Database synced'))
            .catch(err => console.error('Error syncing database:', err));
    }

    // Routes
    app.use('/api/auth', authRoutes);
    app.use('/api', tradeRoutes);

    app.get('/', (req, res) => {
        res.send(`Hello from worker ${process.pid}`);
    });

    app.listen(PORT, () => {
        console.log(`Worker ${process.pid} is running on PORT ${PORT}`);
    });
}
