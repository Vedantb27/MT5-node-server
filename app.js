const express = require('express');
require('dotenv').config();
const sequelize = require('./src/config/database');
const tradeRoutes = require('./src/routes/tradeRoutes');
const redisTradeRoutes = require('./src/routes/redisTradeRoutes');
const cors = require('cors');
const authRoutes = require('./src/routes/auth');
const os = require('os');
const cluster = require('cluster');
const historyRoutes = require('./src/controllers/ChistoryController');
const loginRoutes = require('./src/controllers/CauthController')
const schedule = require('node-schedule');
const { saveServerList, fetchServerList } = require('./src/controllers/ServerListController');
const WebSocket = require('ws');
const { createClient } = require('redis'); // Explicit import for v4+
const jwt = require('jsonwebtoken'); // Assuming JWT is used for auth; adjust if different
const { Accounts } = require('./src/models/Trades'); // Adjust path as needed for your models
const { parseRedisHash } = require('./src/controllers/RedisTradeController');
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
    app.use(cors({
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    }));
    // Sync database (only once, in master or single worker)
    if (cluster.worker.id === 1) {
        sequelize.sync()
            .then(() => console.log('Database synced'))
            .catch(err => console.error('Error syncing database:', err));
    }
    // Redis client setup (per worker) - Use createClient for v4
    const redisClient = createClient({
        socket: {
            host: process.env.REDIS_HOST || '127.0.0.1',
            port: process.env.REDIS_PORT || 6379
        },
        password: process.env.REDIS_PASSWORD
    });
    let redisReady = false;
    redisClient.on('ready', () => {
        console.log(`Redis ready in worker ${process.pid}`);
        redisReady = true;
        app.locals.redisReady = true;
    });
    redisClient.on('error', (err) => {
        console.error(`Redis error in worker ${process.pid}:`, err);
        redisReady = false;
        app.locals.redisReady = false;
    });
    redisClient.connect()
        .then(() => {
            console.log(`Redis connected in worker ${process.pid}`);
        })
        .catch(err => {
            console.error('Redis connection error in worker', process.pid, ':', err);
        });

    // Make redisClient available to routes via app locals
    app.locals.redisClient = redisClient;
    app.locals.redisReady = redisReady;

    if (cluster.worker.id === 1) {
        schedule.scheduleJob('0 */2 * * *', async () => {
            try {
                const servers = await fetchServerList();
                saveServerList(servers);
                console.log('Server list updated successfully via scheduler');
            } catch (err) {
                console.error('Error updating server list via scheduler:', err);
            }
        });
        console.log('Scheduler for server list initialized in worker 1');
    }
    // Routes
    app.use('/api/auth', authRoutes);
    app.use('/api', tradeRoutes);
    app.use('/api/trade-manager', redisTradeRoutes);
    app.use('/api2', historyRoutes.router);
    app.use('/api2', loginRoutes.router);
    app.get('/', (req, res) => {
        res.send(`Hello from worker check CI-CD2 ${process.pid}`);
    });
    // Create HTTP server
    const httpServer = app.listen(PORT, () => {
        console.log(`Worker ${process.pid} is running on PORT ${PORT}`);
    });
    // WebSocket server attached to HTTP server
    const wss = new WebSocket.Server({ server: httpServer });
    wss.on('connection', async (ws, req) => {
        // Parse query params: ?token=...&accountNumber=...
        const url = new URL(req.url, `http://${req.headers.host}`);
        const params = url.searchParams;
        const token = params.get('token');
        const accountNumber = params.get('accountNumber');
        if (!token || !accountNumber) {
            ws.close(1008, 'Missing required parameters: token, accountNumber');
            return;
        }
        // Verify JWT token (adjust based on your auth implementation)
        let user;
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            user = decoded;
        } catch (err) {
            console.error('Token verification failed:', err);
            ws.close(1008, 'Invalid or expired token');
            return;
        }
        // Validate account belongs to user
        let account;
        try {
            account = await Accounts.findOne({
                where: {
                    userId: user.id, // Assuming token payload has 'id' as userId
                    accountNumber: accountNumber
                }
            });
        } catch (err) {
            console.error('Account validation error:', err);
            ws.close(1008, 'Database error');
            return;
        }
        if (!account) {
            ws.close(1008, 'Invalid account for this user');
            return;
        }
        const namespace = `bot:${user.id}:${accountNumber}:`; // Use decoded user.id for namespace
        // Function to fetch data safely
        const fetchRedisData = async () => {
            if (!redisReady) {
                console.log('Redis not ready, skipping poll');
                return null;
            }
            try {
                // Fetch pending orders
                const tradingOrdersIds = await redisClient.sMembers(`${namespace}trading_orders_ids`); // Use sMembers for v4
                const pending = await Promise.all(
                    tradingOrdersIds.map(async (id) => {
                        const key = `${namespace}order:${id}`;
                        const data = await redisClient.hGetAll(key); // Use hGetAll for v4
                        const parsed = parseRedisHash(data);
                        return parsed;
                    })
                );
                // Fetch running trades
                const runningTradesIds = await redisClient.sMembers(`${namespace}running_trades_ids`);
                const running = await Promise.all(
                    runningTradesIds.map(async (id) => {
                        const key = `${namespace}running_trade:${id}`;
                        const data = await redisClient.hGetAll(key);
                        const parsed = parseRedisHash(data);
                        return parsed;
                    })
                );
                // Fetch market data for symbols
                const marketKeys = await redisClient.keys(`${namespace}market:*`);
                const market = await Promise.all(
                    marketKeys.map(async (key) => {
                        const data = await redisClient.hGetAll(key);
                        const symbol = key.split(':').pop();
                        const bid = data.bid === 'null' ? null : parseFloat(data.bid);
                        const ask = data.ask === 'null' ? null : parseFloat(data.ask);
                        const timestamp = data.timestamp;
                        return { symbol, bid, ask, timestamp };
                    })
                );
                // Fetch account info
                const accountKey = `${namespace}account_info`;
                const accountData = await redisClient.hGetAll(accountKey);
                let account = null;
                if (Object.keys(accountData).length > 0) {
                    account = {
                        currency: accountData.currency ? JSON.parse(accountData.currency) : null,
                        balance: accountData.balance ? parseFloat(accountData.balance) : null,
                        equity: accountData.equity ? parseFloat(accountData.equity) : null,
                        timestamp: accountData.timestamp ? JSON.parse(accountData.timestamp) : null
                    };
                }
                return {
                    pending,
                    running,
                    market,
                    account
                };
            } catch (err) {
                console.error('Error in fetchRedisData:', err);
                return null;
            }
        };
        // Polling interval for real-time updates (every 50ms for "as soon as possible"; adjust as needed)
        const interval = setInterval(async () => {
            if (ws.readyState !== WebSocket.OPEN) {
                clearInterval(interval);
                return;
            }
            const data = await fetchRedisData();
            if (data) {
                ws.send(JSON.stringify({ type: 'update', data, timestamp: Date.now() }));
            } else if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'error', message: 'Failed to fetch data' }));
            }
        }, 425); 
       
        ws.send(JSON.stringify({ type: 'connected', message: 'Connected to trading data stream', userId: user.id, accountNumber }));
        ws.on('close', () => {
            clearInterval(interval);
            console.log(`WebSocket closed for user ${user.id}, account ${accountNumber}`);
        });
        ws.on('error', (err) => {
            console.error('WebSocket error:', err);
            clearInterval(interval);
        });
    });
}