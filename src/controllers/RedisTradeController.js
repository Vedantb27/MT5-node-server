const { Accounts } = require('../models/Trades');
const { getServerTime } = require('../utils/common');

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

const isValidNumber = (value, min = 0, max = 100000000000000) => {
    if (value === undefined || value === null) return true;
    const num = parseFloat(value);
    return !isNaN(num) && isFinite(num) && num >= min && num <= max;
};

const validateOrderType = (type) => {
    if (type == null) return false;
    const lower = type.toString().toLowerCase();
    return lower === 'limit' || lower === 'stop';
};

const validateTradeSetup = (setup) => {
    if (setup == null) return false;
    const lower = setup.toString().toLowerCase();
    return lower === 'buy' || lower === 'sell';
};

const addPending = async (req, res) => {
    const client = req.app.locals.redisClient;
    const redisReady = req.app.locals.redisReady;
    if (!redisReady) return res.status(503).json({ message: 'Redis not ready' });
    const userId = req.user?.id;
    const { accountNumber, id, ...orderData } = req.body;
    if (!userId || !accountNumber || !id) return res.status(400).json({ message: 'userId, accountNumber, id required' });

    if (!validateOrderType(orderData.order_type)) {
        return res.status(400).json({ message: 'order_type must be "limit" or "stop" ' });
    }
    if (!validateTradeSetup(orderData.trade_setup)) {
        return res.status(400).json({ message: 'trade_setup must be "buy" or "sell" ' });
    }

    try {
        const Account = await Accounts.findOne({
            where: { userId, accountNumber }
        });
        if (!Account) {
            return res.status(403).json({ message: 'Invalid account number for this user' });
        }

        const startTime = getServerTime().toISOString();
        orderData.start_time = startTime;
        const namespace = `bot:${userId}:${accountNumber}:`;
        const key = `${namespace}order:${id}`;
        const multi = client.multi();
        for (const [k, v] of Object.entries(orderData)) {
            multi.hSet(key, k, JSON.stringify(v));
        }
        multi.sAdd(`${namespace}trading_orders_ids`, id);
        await multi.exec();
        res.status(200).json({ status: 201, message: 'Pending order added successfully', success: true, id });
    } catch (err) {
        console.error('Add pending error:', err);
        res.status(500).json({ message: err.message });
    }
};

const updatePending = async (req, res) => {
    const client = req.app.locals.redisClient;
    const redisReady = req.app.locals.redisReady;
    if (!redisReady) return res.status(503).json({ message: "Redis not ready" });

    const userId = req.user?.id;
    const { accountNumber, stopLoss, takeProfit, removalPrice } = req.body;
    const id = req.params.id;

    if (!userId || !accountNumber || !id) {
        return res.status(400).json({ message: "userId, accountNumber, and id required" });
    }

    if (stopLoss !== undefined && !isValidNumber(stopLoss)) {
        return res.status(400).json({ message: "stopLoss must be a valid number" });
    }
    if (takeProfit !== undefined && !isValidNumber(takeProfit)) {
        return res.status(400).json({ message: "takeProfit must be a valid number" });
    }
    if (removalPrice !== undefined && !isValidNumber(removalPrice)) {
        return res.status(400).json({ message: "removalPrice must be a valid number" });
    }

    try {
        // Validate account
        const Account = await Accounts.findOne({
            where: { userId, accountNumber },
        });

        if (!Account) {
            return res.status(403).json({ message: "Invalid account number for this user" });
        }

        const namespace = `bot:${userId}:${accountNumber}:`;
        const key = `${namespace}order:${id}`;

        const existingData = await client.hGetAll(key);
        if (Object.keys(existingData).length === 0) {
            return res.status(404).json({ message: "Order not found" });
        }

        // Parse values if stored as JSON strings
        const existingStopLoss = existingData.stopLoss ? JSON.parse(existingData.stopLoss) : null;
        const existingTakeProfit = existingData.takeProfit ? JSON.parse(existingData.takeProfit) : null;

        // Determine if updates are needed
        const updates = {};
        if (stopLoss && stopLoss !== existingStopLoss) {
            updates.slToUpdate = stopLoss;
        }
        if (takeProfit && takeProfit !== existingTakeProfit) {
            updates.tpToUpdate = takeProfit;
        }
        if (removalPrice) {
            updates.removalPrice = removalPrice;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(200).json({ status: 201, message: "No changes detected, nothing updated", success: true });
        }

        // Perform selective updates
        const multi = client.multi();
        for (const [k, v] of Object.entries(updates)) {
            multi.hSet(key, k, JSON.stringify(v));
        }
        await multi.exec();

        res.status(200).json({
            status: 201,
            message: 'Pending order updated successfully',
            success: true,
            updatedFields: Object.keys(updates),
            updates,
        });
    } catch (err) {
        console.error("Update pending error:", err);
        res.status(500).json({ message: err.message });
    }
};


const addSpotToPending = async (req, res) => {
    const client = req.app.locals.redisClient;
    const redisReady = req.app.locals.redisReady;
    if (!redisReady) return res.status(503).json({ message: 'Redis not ready' });
    const userId = req.user?.id;
    const { accountNumber, entry_price, stoploss, take_profit, risk_percentage } = req.body;
    const parentId = req.params.parentId;
    if (!userId || !accountNumber || !parentId || entry_price === undefined || stoploss === undefined || risk_percentage === undefined) {
        return res.status(400).json({ message: 'userId, accountNumber, parentId, entry_price, stoploss, risk_percentage required' });
    }
    if (!isValidNumber(entry_price)) {
        return res.status(400).json({ message: 'entry_price must be a valid number' });
    }
    if (!isValidNumber(stoploss)) {
        return res.status(400).json({ message: 'stoploss must be a valid number' });
    }
    if (!isValidNumber(take_profit)) {
        return res.status(400).json({ message: 'take_profit must be a valid number' });
    }
    if (!isValidNumber(risk_percentage, 0, 100)) {
        return res.status(400).json({ message: 'risk_percentage must be a valid number between 0 and 100' });
    }
    try {
        const Account = await Accounts.findOne({
            where: { userId, accountNumber }
        });
        if (!Account) {
            return res.status(403).json({ message: 'Invalid account number for this user' });
        }
        const namespace = `bot:${userId}:${accountNumber}:`;
        const key = `${namespace}order:${parentId}`;
        const data = await client.hGetAll(key);
        if (Object.keys(data).length === 0) {
            return res.status(404).json({ message: 'Pending order not found' });
        }
        const order = parseRedisHash(data);
        if (!order.spot_adds) order.spot_adds = [];
        order.spot_adds.push({ entry_price, stoploss, take_profit, risk_percentage, order_id: null });
        await client.hSet(key, 'spot_adds', JSON.stringify(order.spot_adds));
        res.status(200).json({ status: 201, message: 'Spot add added to pending order successfully', success: true, spotIndex: order.spot_adds.length - 1 });
    } catch (err) {
        console.error('Add spot to pending error:', err);
        res.status(500).json({ message: err.message });
    }
};

const updateSpotInPending = async (req, res) => {
    const client = req.app.locals.redisClient;
    const redisReady = req.app.locals.redisReady;
    if (!redisReady) return res.status(503).json({ message: 'Redis not ready' });
    const userId = req.user?.id;
    const { accountNumber, entry_price, stoploss, take_profit, risk_percentage } = req.body;
    const { parentId, index } = req.params;
    const idx = parseInt(index);
    if (!userId || !accountNumber || !parentId || isNaN(idx)) {
        return res.status(400).json({ message: 'userId, accountNumber, parentId, valid index required' });
    }
    if (entry_price !== undefined && !isValidNumber(entry_price)) {
        return res.status(400).json({ message: 'entry_price must be a valid number' });
    }
    if (stoploss !== undefined && !isValidNumber(stoploss)) {
        return res.status(400).json({ message: 'stoploss must be a valid number' });
    }
    if (take_profit !== undefined && !isValidNumber(take_profit)) {
        return res.status(400).json({ message: 'take_profit must be a valid number' });
    }
    if (risk_percentage !== undefined && !isValidNumber(risk_percentage, 0, 100)) {
        return res.status(400).json({ message: 'risk_percentage must be a valid number between 0 and 100' });
    }
    try {
        const Account = await Accounts.findOne({
            where: { userId, accountNumber }
        });
        if (!Account) {
            return res.status(403).json({ message: 'Invalid account number for this user' });
        }
        const namespace = `bot:${userId}:${accountNumber}:`;
        const key = `${namespace}order:${parentId}`;
        const data = await client.hGetAll(key);
        if (Object.keys(data).length === 0) {
            return res.status(404).json({ message: 'Pending order not found' });
        }
        const order = parseRedisHash(data);
        if (!order.spot_adds || idx >= order.spot_adds.length) {
            return res.status(404).json({ message: 'Spot add not found' });
        }
        order.spot_adds[idx] = { ...req.body, order_id: order.spot_adds[idx]?.order_id || null };
        delete spot_adds[idx].accountNumber;
        await client.hSet(key, 'spot_adds', JSON.stringify(order.spot_adds));
        res.status(200).json({ status: 201, message: 'Spot add in pending order updated successfully', success: true });
    } catch (err) {
        console.error('Update spot in pending error:', err);
        res.status(500).json({ message: err.message });
    }
};



const addRunningOrderToAdd = async (req, res) => {
    const client = req.app.locals.redisClient;
    const redisReady = req.app.locals.redisReady;
    if (!redisReady) return res.status(503).json({ message: 'Redis not ready' });
    const userId = req.user?.id;
    const { accountNumber, id, symbol, trade_setup, stopLoss, risk_percentage, takeProfit } = req.body;
    if (!userId || !accountNumber || !id || !symbol || !trade_setup || stopLoss === undefined || risk_percentage === undefined) {
        return res.status(400).json({ message: 'userId, accountNumber, id, symbol, trade_setup, stopLoss, risk_percentage required' });
    }
    if (typeof symbol !== 'string' || symbol.trim() === '') {
        return res.status(400).json({ message: 'symbol must be a non-empty string' });
    }
    if (!validateTradeSetup(trade_setup)) {
        return res.status(400).json({ message: 'trade_setup must be "buy" or "sell"' });
    }
    if (!isValidNumber(stopLoss)) {
        return res.status(400).json({ message: 'stopLoss must be a valid number' });
    }
    if (!isValidNumber(risk_percentage, 0, 100)) {
        return res.status(400).json({ message: 'risk_percentage must be a valid number between 0 and 100' });
    }
    if (takeProfit !== undefined && !isValidNumber(takeProfit)) {
        return res.status(400).json({ message: 'takeProfit must be a valid number' });
    }
    try {
        const Account = await Accounts.findOne({
            where: { userId, accountNumber }
        });
        if (!Account) {
            return res.status(403).json({ message: 'Invalid account number for this user' });
        }
        const namespace = `bot:${userId}:${accountNumber}:`;
        const key = `${namespace}running_order_to_add:${id}`;
        const orderData = { symbol, trade_setup, stopLoss, risk_percentage };
        if (takeProfit !== undefined) {
            orderData.takeProfit = takeProfit;
        }
        const multi = client.multi();
        for (const [k, v] of Object.entries(orderData)) {
            multi.hSet(key, k, JSON.stringify(v));
        }
        multi.sAdd(`${namespace}running_orders_to_add_ids`, id);
        await multi.exec();
        res.status(200).json({ status: 201, message: 'Market order added successfully', success: true, id });
    } catch (err) {
        console.error('Add running order to add error:', err);
        res.status(500).json({ message: err.message });
    }
};

const updateSlTpBreakeven = async (req, res) => {
    const client = req.app.locals.redisClient;
    const redisReady = req.app.locals.redisReady;
    if (!redisReady) return res.status(503).json({ message: 'Redis not ready' });
    const userId = req.user?.id;
    const { accountNumber, slToUpdate, tpToUpdate, breakevenPrice } = req.body;
    const id = req.params.id;
    if (!userId || !accountNumber || !id) {
        return res.status(400).json({ message: 'userId, accountNumber, id required' });
    }
    if (slToUpdate !== undefined && !isValidNumber(slToUpdate)) {
        return res.status(400).json({ message: 'slToUpdate must be a valid number' });
    }
    if (tpToUpdate !== undefined && !isValidNumber(tpToUpdate)) {
        return res.status(400).json({ message: 'tpToUpdate must be a valid number' });
    }
    if (breakevenPrice !== undefined && !isValidNumber(breakevenPrice)) {
        return res.status(400).json({ message: 'breakevenPrice must be a valid number' });
    }
    const updates = {};
    if (slToUpdate ) updates.slToUpdate = slToUpdate;
    if (tpToUpdate ) updates.tpToUpdate = tpToUpdate;
    if (breakevenPrice ) updates.breakevenPrice = breakevenPrice;
    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: 'No updates provided' });
    }
    try {
        const Account = await Accounts.findOne({
            where: { userId, accountNumber }
        });
        if (!Account) {
            return res.status(403).json({ message: 'Invalid account number for this user' });
        }
        const namespace = `bot:${userId}:${accountNumber}:`;
        const key = `${namespace}running_trade:${id}`;
        const existingData = await client.hGetAll(key);
        if (Object.keys(existingData).length === 0) {
            return res.status(404).json({ message: 'Running trade not found' });
        }
        const multi = client.multi();
        for (const [k, v] of Object.entries(updates)) {
            multi.hSet(key, k, JSON.stringify(v));
        }
        await multi.exec();
        res.status(200).json({ status: 201, message: 'SL/TP/Breakeven updated successfully', success: true });
    } catch (err) {
        console.error('Update SL/TP/BE error:', err);
        res.status(500).json({ message: err.message });
    }
};

const updatePartialClose = async (req, res) => {
    const client = req.app.locals.redisClient;
    const redisReady = req.app.locals.redisReady;
    if (!redisReady) return res.status(503).json({ message: 'Redis not ready' });
    const userId = req.user?.id;
    const { accountNumber, partialClosePrice, lotToClose } = req.body;
    const id = req.params.id;
    if (!userId || !accountNumber || !id) {
        return res.status(400).json({ message: 'userId, accountNumber, id required' });
    }
    if (partialClosePrice !== undefined && !isValidNumber(partialClosePrice)) {
        return res.status(400).json({ message: 'partialClosePrice must be a valid number' });
    }
    if (lotToClose !== undefined) {
        if (!isValidNumber(lotToClose, 0.01)) {
            return res.status(400).json({ message: 'lotToClose must be a positive number (min 0.01)' });
        }
        // Validate <= volume
        try {
            const namespace = `bot:${userId}:${accountNumber}:`;
            const key = `${namespace}running_trade:${id}`;
            const data = await client.hGetAll(key);
            if (Object.keys(data).length === 0) {
                return res.status(404).json({ message: 'Running trade not found' });
            }
            const trade = parseRedisHash(data);
            if (lotToClose > trade.volume) {
                return res.status(400).json({ message: 'lotToClose exceeds trade volume' });
            }
        } catch (e) {
            return res.status(500).json({ message: 'Validation error' });
        }
    }
    const updates = {};
    if (partialClosePrice !== undefined) updates.partialClosePrice = partialClosePrice;
    if (lotToClose !== undefined) updates.lotToClose = lotToClose;
    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: 'No updates provided' });
    }
    try {
        const Account = await Accounts.findOne({
            where: { userId, accountNumber }
        });
        if (!Account) {
            return res.status(403).json({ message: 'Invalid account number for this user' });
        }
        const namespace = `bot:${userId}:${accountNumber}:`;
        const key = `${namespace}running_trade:${id}`;
        const multi = client.multi();
        for (const [k, v] of Object.entries(updates)) {
            multi.hSet(key, k, JSON.stringify(v));
        }
        await multi.exec();
        res.status(200).json({ status: 201, message: 'Partial close updated successfully', success: true });
    } catch (err) {
        console.error('Update partial close error:', err);
        res.status(500).json({ message: err.message });
    }
};

const setVolumeToClose = async (req, res) => {
    const client = req.app.locals.redisClient;
    const redisReady = req.app.locals.redisReady;
    if (!redisReady) return res.status(503).json({ message: 'Redis not ready' });
    const userId = req.user?.id;
    const { accountNumber, volumeToClose } = req.body;
    const id = req.params.id;
    if (!userId || !accountNumber || !id || volumeToClose === undefined) {
        return res.status(400).json({ message: 'userId, accountNumber, id, volumeToClose required' });
    }
    if (!isValidNumber(volumeToClose, 0)) {
        return res.status(400).json({ message: 'volumeToClose must be a non-negative number' });
    }
    try {
        const Account = await Accounts.findOne({
            where: { userId, accountNumber }
        });
        if (!Account) {
            return res.status(403).json({ message: 'Invalid account number for this user' });
        }
        const namespace = `bot:${userId}:${accountNumber}:`;
        const key = `${namespace}running_trade:${id}`;
        const data = await client.hGetAll(key);
        if (Object.keys(data).length === 0) {
            return res.status(404).json({ message: 'Running trade not found' });
        }
        const trade = parseRedisHash(data);
        if (volumeToClose > trade.volume) {
            return res.status(400).json({ message: 'volumeToClose exceeds trade volume' });
        }
        await client.hSet(key, 'volumeToClose', JSON.stringify(volumeToClose));
        res.status(200).json({ status: 201, message: 'Volume to close set successfully', success: true });
    } catch (err) {
        console.error('Set volumeToClose error:', err);
        res.status(500).json({ message: err.message });
    }
};

const addSpotToRunning = async (req, res) => {
    const client = req.app.locals.redisClient;
    const redisReady = req.app.locals.redisReady;
    if (!redisReady) return res.status(503).json({ message: 'Redis not ready' });
    const userId = req.user?.id;
    const { accountNumber, entry_price, stoploss, take_profit, risk_percentage } = req.body;
    const parentId = req.params.parentId;
    if (!userId || !accountNumber || !parentId || entry_price === undefined || stoploss === undefined || risk_percentage === undefined) {
        return res.status(400).json({ message: 'userId, accountNumber, parentId, entry_price, stoploss, risk_percentage required' });
    }
    if (!isValidNumber(entry_price)) {
        return res.status(400).json({ message: 'entry_price must be a valid number' });
    }
    if (!isValidNumber(stoploss)) {
        return res.status(400).json({ message: 'stoploss must be a valid number' });
    }
    if (!isValidNumber(take_profit)) {
        return res.status(400).json({ message: 'take_profit must be a valid number' });
    }
    if (!isValidNumber(risk_percentage, 0, 100)) {
        return res.status(400).json({ message: 'risk_percentage must be a valid number between 0 and 100' });
    }
    try {
        const Account = await Accounts.findOne({
            where: { userId, accountNumber }
        });
        if (!Account) {
            return res.status(403).json({ message: 'Invalid account number for this user' });
        }
        const namespace = `bot:${userId}:${accountNumber}:`;
        const key = `${namespace}running_trade:${parentId}`;
        const data = await client.hGetAll(key);
        if (Object.keys(data).length === 0) {
            return res.status(404).json({ message: 'Running trade not found' });
        }
        const trade = parseRedisHash(data);
        if (!trade.spot_adds) trade.spot_adds = [];
        trade.spot_adds.push({ entry_price, stoploss, take_profit, risk_percentage, order_id: null });
        await client.hSet(key, 'spot_adds', JSON.stringify(trade.spot_adds));
        res.status(200).json({ status: 201, message: 'Spot add added to running trade successfully', success: true, spotIndex: trade.spot_adds.length - 1 });
    } catch (err) {
        console.error('Add spot to running error:', err);
        res.status(500).json({ message: err.message });
    }
};

const updateSpotInRunning = async (req, res) => {
    const client = req.app.locals.redisClient;
    const redisReady = req.app.locals.redisReady;
    if (!redisReady) return res.status(503).json({ message: 'Redis not ready' });
    const userId = req.user?.id;
    const { accountNumber, entry_price, stoploss, take_profit, risk_percentage } = req.body;
    const { parentId, index } = req.params;
    const idx = parseInt(index);
    if (!userId || !accountNumber || !parentId || isNaN(idx)) {
        return res.status(400).json({ message: 'userId, accountNumber, parentId, valid index required' });
    }
    if (entry_price !== undefined && !isValidNumber(entry_price)) {
        return res.status(400).json({ message: 'entry_price must be a valid number' });
    }
    if (stoploss !== undefined && !isValidNumber(stoploss)) {
        return res.status(400).json({ message: 'stoploss must be a valid number' });
    }
    if (take_profit !== undefined && !isValidNumber(take_profit)) {
        return res.status(400).json({ message: 'take_profit must be a valid number' });
    }
    if (risk_percentage !== undefined && !isValidNumber(risk_percentage, 0, 100)) {
        return res.status(400).json({ message: 'risk_percentage must be a valid number between 0 and 100' });
    }
    try {
        const Account = await Accounts.findOne({
            where: { userId, accountNumber }
        });
        if (!Account) {
            return res.status(403).json({ message: 'Invalid account number for this user' });
        }
        const namespace = `bot:${userId}:${accountNumber}:`;
        const key = `${namespace}running_trade:${parentId}`;
        const data = await client.hGetAll(key);
        if (Object.keys(data).length === 0) {
            return res.status(404).json({ message: 'Running trade not found' });
        }
        const trade = parseRedisHash(data);
        if (!trade.spot_adds || idx >= trade.spot_adds.length) {
            return res.status(404).json({ message: 'Spot add not found' });
        }
        if (trade?.spot_adds[idx]?.order_id) {
            return res.status(400).json({ message: 'This spot is already executed and cant be updated' });
        }

        trade.spot_adds[idx] = { ...req.body, order_id: trade.spot_adds[idx]?.order_id || null };
        delete trade.spot_adds[idx].accountNumber;
        await client.hSet(key, 'spot_adds', JSON.stringify(trade.spot_adds));
        res.status(200).json({ status: 201, message: 'Spot add in running trade updated successfully', success: true });
    } catch (err) {
        console.error('Update spot in running error:', err);
        res.status(500).json({ message: err.message });
    }
};


const queueSpotDelete = async (req, res) => {
    const client = req.app.locals.redisClient;
    const redisReady = req.app.locals.redisReady;
    if (!redisReady) return res.status(503).json({ message: 'Redis not ready' });
    const userId = req.user?.id;
    const { accountNumber, tradeId, spotIndex } = req.body;
    if (!userId || !accountNumber || !tradeId || spotIndex === undefined) {
        return res.status(400).json({ message: 'userId, accountNumber, tradeId, spotIndex required' });
    }
    const indexNum = parseInt(spotIndex);
    if (isNaN(indexNum) || indexNum < 0) {
        return res.status(400).json({ message: 'spotIndex must be a non-negative integer' });
    }
    try {
        const Account = await Accounts.findOne({
            where: { userId, accountNumber }
        });
        if (!Account) {
            return res.status(403).json({ message: 'Invalid account number for this user' });
        }
        const namespace = `bot:${userId}:${accountNumber}:`;
        const spotEntry = `${tradeId}:${spotIndex}`;
        // Validate spot exists and has no order_id
        const isRunning = await client.sIsMember(`${namespace}running_trades_ids`, tradeId);
        const key = isRunning ? `${namespace}running_trade:${tradeId}` : `${namespace}order:${tradeId}`;
        const data = await client.hGetAll(key);
        if (Object.keys(data).length === 0) {
            return res.status(404).json({ message: 'Trade not found' });
        }
        const trade = parseRedisHash(data);
        const spotAdd = trade.spot_adds?.[indexNum];
        if (!spotAdd) {
            return res.status(404).json({ message: 'Spot add not found' });
        }
        if (spotAdd.order_id !== null && spotAdd.order_id !== undefined) {
            return res.status(400).json({ message: 'This spot is already executed and cannot be deleted' });
        }
        await client.sAdd(`${namespace}spots_to_delete`, spotEntry);
        res.status(200).json({ status: 201, message: 'Spot queued for deletion successfully', success: true, spotEntry });
    } catch (err) {
        console.error('Queue spot delete error:', err);
        res.status(500).json({ message: err.message });
    }
};

const queueDelete = async (req, res) => {
    const client = req.app.locals.redisClient;
    const redisReady = req.app.locals.redisReady;
    if (!redisReady) return res.status(503).json({ message: 'Redis not ready' });
    const userId = req.user?.id;
    const { accountNumber, orderTicket } = req.body;
    if (!userId || !accountNumber || !orderTicket) {
        return res.status(400).json({ message: 'userId, accountNumber, orderTicket required' });
    }
    const ticketNum = parseInt(orderTicket);
    if (isNaN(ticketNum)) {
        return res.status(400).json({ message: 'orderTicket must be a valid integer' });
    }
    try {
        const Account = await Accounts.findOne({
            where: { userId, accountNumber }
        });
        if (!Account) {
            return res.status(403).json({ message: 'Invalid account number for this user' });
        }
        const namespace = `bot:${userId}:${accountNumber}:`;
        await client.sAdd(`${namespace}orders_to_delete`, orderTicket.toString());
        res.status(200).json({ status: 201, message: 'Order queued for deletion successfully', success: true, orderTicket });
    } catch (err) {
        console.error('Queue delete error:', err);
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    addPending,
    updatePending,
    addSpotToPending,
    updateSpotInPending,
    addRunningOrderToAdd,
    updateSlTpBreakeven,
    updatePartialClose,
    setVolumeToClose,
    addSpotToRunning,
    updateSpotInRunning,
    queueDelete,
    parseRedisHash,
    queueSpotDelete
};