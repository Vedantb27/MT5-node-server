// src/controllers/RedisTradeController.js
const { Accounts } = require('../models/Trades');

const parseRedisHash = (data) => {
    const parsed = {};
    for (const [k, v] of Object.entries(data)) {
        try {
            parsed[k] = JSON.parse(v);
        } catch {
            parsed[k] = v;
        }
    }
    return parsed;
};

const addPending = async (req, res) => {
    const client = req.app.locals.redisClient;
    const redisReady = req.app.locals.redisReady;
    if (!redisReady) return res.status(503).json({ error: 'Redis not ready' });
    const userId = req.user?.id;
    const { accountNumber, id, ...orderData } = req.body;
    if (!userId || !accountNumber || !id) return res.status(400).json({ error: 'userId, accountNumber, id required' });
    try {
        const Account = await Accounts.findOne({
            where: { userId, accountNumber }
        });
        if (!Account) {
            return res.status(403).json({ error: 'Invalid account number for this user' });
        }
        const namespace = `bot:${userId}:${accountNumber}:`;
        const key = `${namespace}order:${id}`;
        const multi = client.multi();
        for (const [k, v] of Object.entries(orderData)) {
            multi.hSet(key, k, JSON.stringify(v));
        }
        multi.sAdd(`${namespace}trading_orders_ids`, id);
        await multi.exec();
        res.json({ success: true, id });
    } catch (err) {
        console.error('Add pending error:', err);
        res.status(500).json({ error: err.message });
    }
};

const updatePending = async (req, res) => {
    const client = req.app.locals.redisClient;
    const redisReady = req.app.locals.redisReady;
    if (!redisReady) return res.status(503).json({ error: 'Redis not ready' });
    const userId = req.user?.id;
    const { accountNumber } = req.body;
    const id = req.params.id;
    let updates = req.body;
    // Exclude spot_adds to not update them here
    delete updates.accountNumber;
    delete updates.spot_adds;
    if (!userId || !accountNumber || !id || Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'userId, accountNumber, id, and updates required' });
    }
    try {
        const Account = await Accounts.findOne({
            where: { userId, accountNumber }
        });
        if (!Account) {
            return res.status(403).json({ error: 'Invalid account number for this user' });
        }
        const namespace = `bot:${userId}:${accountNumber}:`;
        const key = `${namespace}order:${id}`;
        const existingData = await client.hGetAll(key);
        if (Object.keys(existingData).length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        const multi = client.multi();
        for (const [k, v] of Object.entries(updates)) {
            multi.hSet(key, k, JSON.stringify(v));
        }
        await multi.exec();
        res.json({ success: true });
    } catch (err) {
        console.error('Update pending error:', err);
        res.status(500).json({ error: err.message });
    }
};

const addSpotToPending = async (req, res) => {
    const client = req.app.locals.redisClient;
    const redisReady = req.app.locals.redisReady;
    if (!redisReady) return res.status(503).json({ error: 'Redis not ready' });
    const userId = req.user?.id;
    const { accountNumber, entry_price, stoploss, take_profit, risk_percentage } = req.body;
    const parentId = req.params.parentId;
    if (!userId || !accountNumber || !parentId || entry_price === undefined || stoploss === undefined || risk_percentage === undefined) {
        return res.status(400).json({ error: 'userId, accountNumber, parentId, entry_price, stoploss, risk_percentage required' });
    }
    try {
        const Account = await Accounts.findOne({
            where: { userId, accountNumber }
        });
        if (!Account) {
            return res.status(403).json({ error: 'Invalid account number for this user' });
        }
        const namespace = `bot:${userId}:${accountNumber}:`;
        const key = `${namespace}order:${parentId}`;
        const data = await client.hGetAll(key);
        if (Object.keys(data).length === 0) {
            return res.status(404).json({ error: 'Pending order not found' });
        }
        const order = parseRedisHash(data);
        if (!order.spot_adds) order.spot_adds = [];
        order.spot_adds.push({ entry_price, stoploss, take_profit, risk_percentage, order_id: null });
        await client.hSet(key, 'spot_adds', JSON.stringify(order.spot_adds));
        res.json({ success: true, spotIndex: order.spot_adds.length - 1 });
    } catch (err) {
        console.error('Add spot to pending error:', err);
        res.status(500).json({ error: err.message });
    }
};

const updateSpotInPending = async (req, res) => {
    const client = req.app.locals.redisClient;
    const redisReady = req.app.locals.redisReady;
    if (!redisReady) return res.status(503).json({ error: 'Redis not ready' });
    const userId = req.user?.id;
    const { accountNumber } = req.body;
    const { parentId, index } = req.params;
    const spotData = req.body;
    const idx = parseInt(index);
    if (!userId || !accountNumber || !parentId || isNaN(idx)) {
        return res.status(400).json({ error: 'userId, accountNumber, parentId, valid index required' });
    }
    try {
        const Account = await Accounts.findOne({
            where: { userId, accountNumber }
        });
        if (!Account) {
            return res.status(403).json({ error: 'Invalid account number for this user' });
        }
        const namespace = `bot:${userId}:${accountNumber}:`;
        const key = `${namespace}order:${parentId}`;
        const data = await client.hGetAll(key);
        if (Object.keys(data).length === 0) {
            return res.status(404).json({ error: 'Pending order not found' });
        }
        const order = parseRedisHash(data);
        if (!order.spot_adds || idx >= order.spot_adds.length) {
            return res.status(404).json({ error: 'Spot add not found' });
        }
        order.spot_adds[idx] = { ...spotData, order_id: order.spot_adds[idx]?.order_id || null };
        await client.hSet(key, 'spot_adds', JSON.stringify(order.spot_adds));
        res.json({ success: true });
    } catch (err) {
        console.error('Update spot in pending error:', err);
        res.status(500).json({ error: err.message });
    }
};

const addRunning = async (req, res) => {
    const client = req.app.locals.redisClient;
    const redisReady = req.app.locals.redisReady;
    if (!redisReady) return res.status(503).json({ error: 'Redis not ready' });
    const userId = req.user?.id;
    const { accountNumber, id, ...tradeData } = req.body;
    if (!userId || !accountNumber || !id) return res.status(400).json({ error: 'userId, accountNumber, id required' });
    try {
        const Account = await Accounts.findOne({
            where: { userId, accountNumber }
        });
        if (!Account) {
            return res.status(403).json({ error: 'Invalid account number for this user' });
        }
        const namespace = `bot:${userId}:${accountNumber}:`;
        const key = `${namespace}running_trade:${id}`;
        const multi = client.multi();
        for (const [k, v] of Object.entries(tradeData)) {
            multi.hSet(key, k, JSON.stringify(v));
        }
        multi.sAdd(`${namespace}running_trades_ids`, id);
        await multi.exec();
        res.json({ success: true, id });
    } catch (err) {
        console.error('Add running error:', err);
        res.status(500).json({ error: err.message });
    }
};

const updateSlTpBreakeven = async (req, res) => {
    const client = req.app.locals.redisClient;
    const redisReady = req.app.locals.redisReady;
    if (!redisReady) return res.status(503).json({ error: 'Redis not ready' });
    const userId = req.user?.id;
    const { accountNumber, slToUpdate, tpToUpdate, breakevenPrice } = req.body;
    const id = req.params.id;
    if (!userId || !accountNumber || !id) {
        return res.status(400).json({ error: 'userId, accountNumber, id required' });
    }
    const updates = {};
    if (slToUpdate !== undefined && typeof slToUpdate !== 'number') {
        return res.status(400).json({ error: 'slToUpdate must be number' });
    }
    if (tpToUpdate !== undefined && typeof tpToUpdate !== 'number') {
        return res.status(400).json({ error: 'tpToUpdate must be number' });
    }
    if (breakevenPrice !== undefined && typeof breakevenPrice !== 'number') {
        return res.status(400).json({ error: 'breakevenPrice must be number' });
    }
    if (slToUpdate !== undefined) updates.slToUpdate = slToUpdate;
    if (tpToUpdate !== undefined) updates.tpToUpdate = tpToUpdate;
    if (breakevenPrice !== undefined) updates.breakevenPrice = breakevenPrice;
    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
    }
    try {
        const Account = await Accounts.findOne({
            where: { userId, accountNumber }
        });
        if (!Account) {
            return res.status(403).json({ error: 'Invalid account number for this user' });
        }
        const namespace = `bot:${userId}:${accountNumber}:`;
        const key = `${namespace}running_trade:${id}`;
        const existingData = await client.hGetAll(key);
        if (Object.keys(existingData).length === 0) {
            return res.status(404).json({ error: 'Running trade not found' });
        }
        const multi = client.multi();
        for (const [k, v] of Object.entries(updates)) {
            multi.hSet(key, k, JSON.stringify(v));
        }
        await multi.exec();
        res.json({ success: true });
    } catch (err) {
        console.error('Update SL/TP/BE error:', err);
        res.status(500).json({ error: err.message });
    }
};

const updatePartialClose = async (req, res) => {
    const client = req.app.locals.redisClient;
    const redisReady = req.app.locals.redisReady;
    if (!redisReady) return res.status(503).json({ error: 'Redis not ready' });
    const userId = req.user?.id;
    const { accountNumber, partialClosePrice, lotToClose } = req.body;
    const id = req.params.id;
    if (!userId || !accountNumber || !id) {
        return res.status(400).json({ error: 'userId, accountNumber, id required' });
    }
    if (partialClosePrice !== undefined && typeof partialClosePrice !== 'number') {
        return res.status(400).json({ error: 'partialClosePrice must be number' });
    }
    if (lotToClose !== undefined) {
        if (typeof lotToClose !== 'number' || lotToClose <= 0) {
            return res.status(400).json({ error: 'lotToClose must be positive number' });
        }
        // Validate <= volume
        try {
            const namespace = `bot:${userId}:${accountNumber}:`;
            const key = `${namespace}running_trade:${id}`;
            const data = await client.hGetAll(key);
            if (Object.keys(data).length === 0) {
                return res.status(404).json({ error: 'Running trade not found' });
            }
            const trade = parseRedisHash(data);
            if (lotToClose > trade.volume) {
                return res.status(400).json({ error: 'lotToClose exceeds trade volume' });
            }
        } catch (e) {
            return res.status(500).json({ error: 'Validation error' });
        }
    }
    const updates = {};
    if (partialClosePrice !== undefined) updates.partialClosePrice = partialClosePrice;
    if (lotToClose !== undefined) updates.lotToClose = lotToClose;
    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
    }
    try {
        const Account = await Accounts.findOne({
            where: { userId, accountNumber }
        });
        if (!Account) {
            return res.status(403).json({ error: 'Invalid account number for this user' });
        }
        const namespace = `bot:${userId}:${accountNumber}:`;
        const key = `${namespace}running_trade:${id}`;
        const multi = client.multi();
        for (const [k, v] of Object.entries(updates)) {
            multi.hSet(key, k, JSON.stringify(v));
        }
        await multi.exec();
        res.json({ success: true });
    } catch (err) {
        console.error('Update partial close error:', err);
        res.status(500).json({ error: err.message });
    }
};

const setVolumeToClose = async (req, res) => {
    const client = req.app.locals.redisClient;
    const redisReady = req.app.locals.redisReady;
    if (!redisReady) return res.status(503).json({ error: 'Redis not ready' });
    const userId = req.user?.id;
    const { accountNumber, volumeToClose } = req.body;
    const id = req.params.id;
    if (!userId || !accountNumber || !id || typeof volumeToClose !== 'number' || volumeToClose < 0) {
        return res.status(400).json({ error: 'userId, accountNumber, id, non-negative volumeToClose required' });
    }
    try {
        const Account = await Accounts.findOne({
            where: { userId, accountNumber }
        });
        if (!Account) {
            return res.status(403).json({ error: 'Invalid account number for this user' });
        }
        const namespace = `bot:${userId}:${accountNumber}:`;
        const key = `${namespace}running_trade:${id}`;
        const data = await client.hGetAll(key);
        if (Object.keys(data).length === 0) {
            return res.status(404).json({ error: 'Running trade not found' });
        }
        const trade = parseRedisHash(data);
        if (volumeToClose > trade.volume) {
            return res.status(400).json({ error: 'volumeToClose exceeds trade volume' });
        }
        await client.hSet(key, 'volumeToClose', JSON.stringify(volumeToClose));
        res.json({ success: true });
    } catch (err) {
        console.error('Set volumeToClose error:', err);
        res.status(500).json({ error: err.message });
    }
};

const addSpotToRunning = async (req, res) => {
    const client = req.app.locals.redisClient;
    const redisReady = req.app.locals.redisReady;
    if (!redisReady) return res.status(503).json({ error: 'Redis not ready' });
    const userId = req.user?.id;
    const { accountNumber, entry_price, stoploss, take_profit, risk_percentage } = req.body;
    const parentId = req.params.parentId;
    if (!userId || !accountNumber || !parentId || entry_price === undefined || stoploss === undefined || risk_percentage === undefined) {
        return res.status(400).json({ error: 'userId, accountNumber, parentId, entry_price, stoploss, risk_percentage required' });
    }
    try {
        const Account = await Accounts.findOne({
            where: { userId, accountNumber }
        });
        if (!Account) {
            return res.status(403).json({ error: 'Invalid account number for this user' });
        }
        const namespace = `bot:${userId}:${accountNumber}:`;
        const key = `${namespace}running_trade:${parentId}`;
        const data = await client.hGetAll(key);
        if (Object.keys(data).length === 0) {
            return res.status(404).json({ error: 'Running trade not found' });
        }
        const trade = parseRedisHash(data);
        if (!trade.spot_adds) trade.spot_adds = [];
        trade.spot_adds.push({ entry_price, stoploss, take_profit, risk_percentage, order_id: null });
        await client.hSet(key, 'spot_adds', JSON.stringify(trade.spot_adds));
        res.json({ success: true, spotIndex: trade.spot_adds.length - 1 });
    } catch (err) {
        console.error('Add spot to running error:', err);
        res.status(500).json({ error: err.message });
    }
};

const updateSpotInRunning = async (req, res) => {
    const client = req.app.locals.redisClient;
    const redisReady = req.app.locals.redisReady;
    if (!redisReady) return res.status(503).json({ error: 'Redis not ready' });
    const userId = req.user?.id;
    const { accountNumber } = req.body;
    const { parentId, index } = req.params;
    const spotData = req.body;
    const idx = parseInt(index);
    if (!userId || !accountNumber || !parentId || isNaN(idx)) {
        return res.status(400).json({ error: 'userId, accountNumber, parentId, valid index required' });
    }
    try {
        const Account = await Accounts.findOne({
            where: { userId, accountNumber }
        });
        if (!Account) {
            return res.status(403).json({ error: 'Invalid account number for this user' });
        }
        const namespace = `bot:${userId}:${accountNumber}:`;
        const key = `${namespace}running_trade:${parentId}`;
        const data = await client.hGetAll(key);
        if (Object.keys(data).length === 0) {
            return res.status(404).json({ error: 'Running trade not found' });
        }
        const trade = parseRedisHash(data);
        if (!trade.spot_adds || idx >= trade.spot_adds.length) {
            return res.status(404).json({ error: 'Spot add not found' });
        }
        trade.spot_adds[idx] = { ...spotData, order_id: trade.spot_adds[idx]?.order_id || null };
        await client.hSet(key, 'spot_adds', JSON.stringify(trade.spot_adds));
        res.json({ success: true });
    } catch (err) {
        console.error('Update spot in running error:', err);
        res.status(500).json({ error: err.message });
    }
};

const queueDelete = async (req, res) => {
    const client = req.app.locals.redisClient;
    const redisReady = req.app.locals.redisReady;
    if (!redisReady) return res.status(503).json({ error: 'Redis not ready' });
    const userId = req.user?.id;
    const { accountNumber, orderTicket } = req.body;
    if (!userId || !accountNumber || !orderTicket) {
        return res.status(400).json({ error: 'userId, accountNumber, orderTicket required' });
    }
    try {
        const Account = await Accounts.findOne({
            where: { userId, accountNumber }
        });
        if (!Account) {
            return res.status(403).json({ error: 'Invalid account number for this user' });
        }
        const namespace = `bot:${userId}:${accountNumber}:`;
        await client.sAdd(`${namespace}orders_to_delete`, orderTicket.toString());
        res.json({ success: true, orderTicket });
    } catch (err) {
        console.error('Queue delete error:', err);
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    addPending,
    updatePending,
    addSpotToPending,
    updateSpotInPending,
    addRunning,
    updateSlTpBreakeven,
    updatePartialClose,
    setVolumeToClose,
    addSpotToRunning,
    updateSpotInRunning,
    queueDelete,
    parseRedisHash
};