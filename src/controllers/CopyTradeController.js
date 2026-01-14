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

const isValidNumber = (value, min = 0, max = 100000000000000) => {
    if (value === undefined || value === null) return true;
    const num = parseFloat(value);
    return !isNaN(num) && isFinite(num) && num >= min && num <= max;
};

const linkSlaveToMaster = async (req, res) => {
    const client = req.app.locals.redisClient;
    const redisReady = req.app.locals.redisReady;
    if (!redisReady) return res.status(503).json({ message: 'Redis not ready' });
    const userId = req.user?.id;
    const { masterAccount, slaveAccount } = req.body;
    if (!userId || !masterAccount || !slaveAccount) {
        return res.status(400).json({ message: 'userId, masterAccount, slaveAccount required' });
    }
    if (masterAccount === slaveAccount) {
        return res.status(400).json({ message: 'Master and slave accounts must be different' });
    }
    try {
        const masterAcc = await Accounts.findOne({ where: { userId, accountNumber: masterAccount } });
        const slaveAcc = await Accounts.findOne({ where: { userId, accountNumber: slaveAccount } });
        if (!masterAcc || !slaveAcc) {
            return res.status(403).json({ message: 'Invalid master or slave account for this user' });
        }
        const slavesKey = `bot:${userId}:master:${masterAccount}:slaves`;
        const added = await client.sAdd(slavesKey, slaveAccount);
        if (added === 0) {
            return res.status(200).json({ status: 200, message: 'Slave already linked to master', success: true });
        }
        res.status(200).json({ status: 201, message: 'Slave linked to master successfully', success: true });
    } catch (err) {
        console.error('Link slave to master error:', err);
        res.status(500).json({ message: err.message });
    }
};

const unlinkSlaveFromMaster = async (req, res) => {
    const client = req.app.locals.redisClient;
    const redisReady = req.app.locals.redisReady;
    if (!redisReady) return res.status(503).json({ message: 'Redis not ready' });
    const userId = req.user?.id;
    const { masterAccount, slaveAccount } = req.body;
    if (!userId || !masterAccount || !slaveAccount) {
        return res.status(400).json({ message: 'userId, masterAccount, slaveAccount required' });
    }
    try {
        const masterAcc = await Accounts.findOne({ where: { userId, accountNumber: masterAccount } });
        const slaveAcc = await Accounts.findOne({ where: { userId, accountNumber: slaveAccount } });
        if (!masterAcc || !slaveAcc) {
            return res.status(403).json({ message: 'Invalid master or slave account for this user' });
        }
        const slavesKey = `bot:${userId}:master:${masterAccount}:slaves`;
        const removed = await client.sRem(slavesKey, slaveAccount);
        if (removed === 0) {
            return res.status(404).json({ message: 'Slave not linked to this master' });
        }
        res.status(200).json({ status: 200, message: 'Slave unlinked from master successfully', success: true });
    } catch (err) {
        console.error('Unlink slave from master error:', err);
        res.status(500).json({ message: err.message });
    }
};

const setSlavePaused = async (req, res) => {
    const client = req.app.locals.redisClient;
    const redisReady = req.app.locals.redisReady;
    if (!redisReady) return res.status(503).json({ message: 'Redis not ready' });
    const userId = req.user?.id;
    const { masterAccount, slaveAccount, paused } = req.body;
    if (!userId || !masterAccount || !slaveAccount || paused === undefined) {
        return res.status(400).json({ message: 'userId, masterAccount, slaveAccount, paused (boolean) required' });
    }
    if (typeof paused !== 'boolean') {
        return res.status(400).json({ message: 'paused must be a boolean' });
    }
    try {
        const masterAcc = await Accounts.findOne({ where: { userId, accountNumber: masterAccount } });
        const slaveAcc = await Accounts.findOne({ where: { userId, accountNumber: slaveAccount } });
        if (!masterAcc || !slaveAcc) {
            return res.status(403).json({ message: 'Invalid master or slave account for this user' });
        }
        const pauseKey = `bot:${userId}:master:${masterAccount}:slave:${slaveAccount}`;
        await client.hSet(pauseKey, 'paused', paused ? 'true' : 'false');
        res.status(200).json({ status: 201, message: `Slave ${paused ? 'paused' : 'resumed'} successfully`, success: true });
    } catch (err) {
        console.error('Set slave paused error:', err);
        res.status(500).json({ message: err.message });
    }
};

const setMultiplier = async (req, res) => {
    const client = req.app.locals.redisClient;
    const redisReady = req.app.locals.redisReady;
    if (!redisReady) return res.status(503).json({ message: 'Redis not ready' });
    const userId = req.user?.id;
    const { masterAccount, slaveAccount, multiplier } = req.body;
    if (!userId || !masterAccount || !slaveAccount || multiplier === undefined) {
        return res.status(400).json({ message: 'userId, masterAccount, slaveAccount, multiplier required' });
    }
    if (!isValidNumber(multiplier, 0.01, 100)) {
        return res.status(400).json({ message: 'multiplier must be a positive number between 0.01 and 100' });
    }
    try {
        const masterAcc = await Accounts.findOne({ where: { userId, accountNumber: masterAccount } });
        const slaveAcc = await Accounts.findOne({ where: { userId, accountNumber: slaveAccount } });
        if (!masterAcc || !slaveAcc) {
            return res.status(403).json({ message: 'Invalid master or slave account for this user' });
        }
        const namespace = `bot:${userId}:${slaveAccount}:`;
        const multipliersKey = `${namespace}master_multipliers`;
        await client.hSet(multipliersKey, masterAccount, multiplier.toString());
        res.status(200).json({ status: 201, message: 'Multiplier set successfully', success: true });
    } catch (err) {
        console.error('Set multiplier error:', err);
        res.status(500).json({ message: err.message });
    }
};

const setSymbolMap = async (req, res) => {
    const client = req.app.locals.redisClient;
    const redisReady = req.app.locals.redisReady;
    if (!redisReady) return res.status(503).json({ message: 'Redis not ready' });
    const userId = req.user?.id;
    const { slaveAccount, baseSymbol, slaveSymbol, masterAccount } = req.body; // masterAccount optional
    if (!userId || !slaveAccount || !baseSymbol || !slaveSymbol) {
        return res.status(400).json({ message: 'userId, slaveAccount, baseSymbol, slaveSymbol required' });
    }
    if (typeof baseSymbol !== 'string' || baseSymbol.trim() === '' || typeof slaveSymbol !== 'string' || slaveSymbol.trim() === '') {
        return res.status(400).json({ message: 'baseSymbol and slaveSymbol must be non-empty strings' });
    }
    try {
        const slaveAcc = await Accounts.findOne({ where: { userId, accountNumber: slaveAccount } });
        if (!slaveAcc) {
            return res.status(403).json({ message: 'Invalid slave account for this user' });
        }
        const namespace = `bot:${userId}:${slaveAccount}:`;
        const symbolsKey = `${namespace}available_symbols`;
        const slaveExists = await client.sIsMember(symbolsKey, slaveSymbol.toUpperCase());
        if (!slaveExists) {
            return res.status(400).json({ message: 'slaveSymbol does not exist for this slave account' });
        }
        if (masterAccount) {
            const masterAcc = await Accounts.findOne({ where: { userId, accountNumber: masterAccount } });
            if (!masterAcc) {
                return res.status(403).json({ message: 'Invalid master account for this user' });
            }
            const masterNamespace = `bot:${userId}:${masterAccount}:`;
            const masterSymbolsKey = `${masterNamespace}available_symbols`;
            const baseExists = await client.sIsMember(masterSymbolsKey, baseSymbol.toUpperCase());
            if (!baseExists) {
                return res.status(400).json({ message: 'baseSymbol does not exist for this master account' });
            }
        }
        const mapKey = `${namespace}symbol_map`;
        await client.hSet(mapKey, baseSymbol.toUpperCase(), slaveSymbol.toUpperCase());
        res.status(200).json({ status: 201, message: 'Symbol map set successfully', success: true });
    } catch (err) {
        console.error('Set symbol map error:', err);
        res.status(500).json({ message: err.message });
    }
};

const editSymbolMap = async (req, res) => {
    // Alias to setSymbolMap since hSet overwrites
    return setSymbolMap(req, res);
};

const deleteSymbolMap = async (req, res) => {
    const client = req.app.locals.redisClient;
    const redisReady = req.app.locals.redisReady;
    if (!redisReady) return res.status(503).json({ message: 'Redis not ready' });
    const userId = req.user?.id;
    const { slaveAccount, baseSymbol } = req.body;
    if (!userId || !slaveAccount || !baseSymbol) {
        return res.status(400).json({ message: 'userId, slaveAccount, baseSymbol required' });
    }
    if (typeof baseSymbol !== 'string' || baseSymbol.trim() === '') {
        return res.status(400).json({ message: 'baseSymbol must be a non-empty string' });
    }
    try {
        const slaveAcc = await Accounts.findOne({ where: { userId, accountNumber: slaveAccount } });
        if (!slaveAcc) {
            return res.status(403).json({ message: 'Invalid slave account for this user' });
        }
        const namespace = `bot:${userId}:${slaveAccount}:`;
        const mapKey = `${namespace}symbol_map`;
        const deleted = await client.hDel(mapKey, baseSymbol.toUpperCase());
        if (deleted === 0) {
            return res.status(404).json({ message: 'Symbol mapping not found' });
        }
        res.status(200).json({ status: 200, message: 'Symbol map deleted successfully', success: true });
    } catch (err) {
        console.error('Delete symbol map error:', err);
        res.status(500).json({ message: err.message });
    }
};

const setCommonAliases = async (req, res) => {
    const client = req.app.locals.redisClient;
    const redisReady = req.app.locals.redisReady;
    if (!redisReady) return res.status(503).json({ message: 'Redis not ready' });
    const userId = req.user?.id;
    const { slaveAccount, aliases } = req.body;
    if (!userId || !slaveAccount || typeof aliases !== 'object' || aliases === null) {
        return res.status(400).json({ message: 'userId, slaveAccount, aliases (object) required' });
    }
    // Basic validation: aliases should be {string: array of strings}
    for (const [key, val] of Object.entries(aliases)) {
        if (typeof key !== 'string' || !Array.isArray(val) || val.some(v => typeof v !== 'string')) {
            return res.status(400).json({ message: 'aliases must be an object with string keys and array of strings values' });
        }
    }
    try {
        const slaveAcc = await Accounts.findOne({ where: { userId, accountNumber: slaveAccount } });
        if (!slaveAcc) {
            return res.status(403).json({ message: 'Invalid slave account for this user' });
        }
        const namespace = `bot:${userId}:${slaveAccount}:`;
        const aliasesKey = `${namespace}common_aliases`;
        await client.set(aliasesKey, JSON.stringify(aliases));
        res.status(200).json({ status: 201, message: 'Common aliases set successfully', success: true });
    } catch (err) {
        console.error('Set common aliases error:', err);
        res.status(500).json({ message: err.message });
    }
};

const getSlavesForMaster = async (req, res) => {
    const client = req.app.locals.redisClient;
    const redisReady = req.app.locals.redisReady;
    if (!redisReady) return res.status(503).json({ message: 'Redis not ready' });
    const userId = req.user?.id;
    const { masterAccount } = req.query;
    if (!userId || !masterAccount) {
        return res.status(400).json({ message: 'userId, masterAccount required' });
    }
    try {
        const masterAcc = await Accounts.findOne({ where: { userId, accountNumber: masterAccount } });
        if (!masterAcc) {
            return res.status(403).json({ message: 'Invalid master account for this user' });
        }
        const slavesKey = `bot:${userId}:master:${masterAccount}:slaves`;
        const slaves = await client.sMembers(slavesKey);
        res.status(200).json({ status: 200, message: 'Slaves fetched successfully', success: true, slaves });
    } catch (err) {
        console.error('Get slaves for master error:', err);
        res.status(500).json({ message: err.message });
    }
};

const getSlaveConfig = async (req, res) => {
    const client = req.app.locals.redisClient;
    const redisReady = req.app.locals.redisReady;
    if (!redisReady) return res.status(503).json({ message: 'Redis not ready' });
    const userId = req.user?.id;
    const { slaveAccount, masterAccount } = req.query;
    if (!userId || !slaveAccount || !masterAccount) {
        return res.status(400).json({ message: 'userId, slaveAccount, masterAccount required' });
    }
    try {
        const slaveAcc = await Accounts.findOne({ where: { userId, accountNumber: slaveAccount } });
        const masterAcc = await Accounts.findOne({ where: { userId, accountNumber: masterAccount } });
        if (!slaveAcc || !masterAcc) {
            return res.status(403).json({ message: 'Invalid slave or master account for this user' });
        }
        const pauseKey = `bot:${userId}:master:${masterAccount}:slave:${slaveAccount}`;
        const pausedRaw = await client.hGet(pauseKey, 'paused');
        const paused = pausedRaw?.toLowerCase() === 'true';
        const namespace = `bot:${userId}:${slaveAccount}:`;
        const multipliersKey = `${namespace}master_multipliers`;
        const multiplier = parseFloat(await client.hGet(multipliersKey, masterAccount)) || 1.0;
        res.status(200).json({
            status: 200,
            message: 'Slave config fetched successfully',
            success: true,
            config: { paused, multiplier }
        });
    } catch (err) {
        console.error('Get slave config error:', err);
        res.status(500).json({ message: err.message });
    }
};

const getSymbolMap = async (req, res) => {
    const client = req.app.locals.redisClient;
    const redisReady = req.app.locals.redisReady;
    if (!redisReady) return res.status(503).json({ message: 'Redis not ready' });
    const userId = req.user?.id;
    const { slaveAccount } = req.query;
    if (!userId || !slaveAccount) {
        return res.status(400).json({ message: 'userId, slaveAccount required' });
    }
    try {
        const slaveAcc = await Accounts.findOne({ where: { userId, accountNumber: slaveAccount } });
        if (!slaveAcc) {
            return res.status(403).json({ message: 'Invalid slave account for this user' });
        }
        const namespace = `bot:${userId}:${slaveAccount}:`;
        const mapKey = `${namespace}symbol_map`;
        const symbolMapRaw = await client.hGetAll(mapKey);
        const symbolMap = {};
        for (const [k, v] of Object.entries(symbolMapRaw)) {
            symbolMap[k] = v; // already strings
        }
        res.status(200).json({ status: 200, message: 'Symbol map fetched successfully', success: true, symbolMap });
    } catch (err) {
        console.error('Get symbol map error:', err);
        res.status(500).json({ message: err.message });
    }
};

const getCommonAliases = async (req, res) => {
    const client = req.app.locals.redisClient;
    const redisReady = req.app.locals.redisReady;
    if (!redisReady) return res.status(503).json({ message: 'Redis not ready' });
    const userId = req.user?.id;
    const { slaveAccount } = req.query;
    if (!userId || !slaveAccount) {
        return res.status(400).json({ message: 'userId, slaveAccount required' });
    }
    try {
        const slaveAcc = await Accounts.findOne({ where: { userId, accountNumber: slaveAccount } });
        if (!slaveAcc) {
            return res.status(403).json({ message: 'Invalid slave account for this user' });
        }
        const namespace = `bot:${userId}:${slaveAccount}:`;
        const aliasesKey = `${namespace}common_aliases`;
        const aliasesRaw = await client.get(aliasesKey);
        let aliases = {};
        if (aliasesRaw) {
            try {
                aliases = JSON.parse(aliasesRaw);
            } catch {
                aliases = {};
            }
        }
        res.status(200).json({ status: 200, message: 'Common aliases fetched successfully', success: true, aliases });
    } catch (err) {
        console.error('Get common aliases error:', err);
        res.status(500).json({ message: err.message });
    }
};

const getAccountSymbols = async (req, res) => {
    const client = req.app.locals.redisClient;
    const redisReady = req.app.locals.redisReady;
    if (!redisReady) return res.status(503).json({ message: 'Redis not ready' });
    const userId = req.user?.id;
    const { accountNumber } = req.query;
    if (!userId || !accountNumber) {
        return res.status(400).json({ message: 'userId, accountNumber required' });
    }
    try {
        const acc = await Accounts.findOne({ where: { userId, accountNumber } });
        if (!acc) {
            return res.status(403).json({ message: 'Invalid account for this user' });
        }
        const namespace = `bot:${userId}:${accountNumber}:`;
        const symbolsKey = `${namespace}available_symbols`;
        const symbols = await client.sMembers(symbolsKey);
        res.status(200).json({ status: 200, message: 'Account symbols fetched successfully', success: true, symbols: symbols.sort() });
    } catch (err) {
        console.error('Get account symbols error:', err);
        res.status(500).json({ message: err.message });
    }
};

const createMaster = async (req, res) => {
    const client = req.app.locals.redisClient;
    const redisReady = req.app.locals.redisReady;
    if (!redisReady) return res.status(503).json({ message: 'Redis not ready' });
    const userId = req.user?.id;
    const { accountNumber } = req.body;
    if (!userId || !accountNumber) {
        return res.status(400).json({ message: 'userId, accountNumber required' });
    }
    try {
        const acc = await Accounts.findOne({ where: { userId, accountNumber } });
        if (!acc) {
            return res.status(403).json({ message: 'Invalid account for this user' });
        }
        const namespace = `bot:${userId}:${accountNumber}:`;
        const key = `${namespace}account_info`;
        await client.hSet(key, 'accountType', 'Master');
        res.status(200).json({ status: 201, message: 'Master account created successfully', success: true });
    } catch (err) {
        console.error('Create master error:', err);
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    linkSlaveToMaster,
    unlinkSlaveFromMaster,
    setSlavePaused,
    setMultiplier,
    setSymbolMap,
    editSymbolMap,
    deleteSymbolMap,
    setCommonAliases,
    getSlavesForMaster,
    getSlaveConfig,
    getSymbolMap,
    getCommonAliases,
    getAccountSymbols,
    createMaster,
    parseRedisHash
};