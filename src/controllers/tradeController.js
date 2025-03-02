const axios = require('axios');
const Trades = require('../models/Trades');

const fetchTrades = async (req, res) => {
    try {
        const response = await axios.get('http://localhost:5000/api/trading-history');
        const tradeData = response.data.completed_trades;

        if (!tradeData || !Array.isArray(tradeData)) {
            return res.status(400).json({ error: 'Invalid trade data received' });
        }

        for (const trade of tradeData) {
            await Trades.create({
                position_id: trade.position_id,
                open_date: trade.opening_date,
                open_time: trade.opening_time,
                close_date: trade.closing_date,
                close_time: trade.closing_time,
                trade_duration: trade.duration_formatted,
                trade_duration_seconds: trade.duration_seconds,
                open_price: trade.open_price,
                close_price: trade.close_price,
                no_of_deals: trade.deals ? trade.deals.length : 0,
                profit: trade.profit,
                sl_price: trade.sl_price ? parseFloat(trade.sl_price) : null,
                tp_price: trade.tp_price ? parseFloat(trade.tp_price) : null,
                type: trade.type,
                symbol: trade.symbol,
                volume: trade.volume
            });
        }

        res.status(200).json({ message: 'Trade history stored successfully' });
    } catch (err) {
        console.error('Error fetching or storing trade history:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getTradeHistory = async (req, res) => {
    try {
        const trades = await Trades.findAll();
        res.status(200).json(trades);
    } catch (err) {
        console.error('Error fetching trade history:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const mt5Login = async (req, res) => {
    const { account, password, server } = req.body;
    if (!account || !password || !server) {
        return res.status(400).json({ error: 'Invalid request body' });
    }

    try {
        const response = await axios.post('http://localhost:5000/api/mt5-login', {
            account,
            password,
            server
        });

        const mt5Data = response.data;
        if (!mt5Data.success) {
            return res.status(401).json({ error: 'MT5 login failed', details: mt5Data.error });
        }

        return res.status(200).json({
            success: true,
            message: 'MT5 Credentials saved successfully',
            account_info: mt5Data.account_info
        });

    } catch (err) {
        console.log('Error saving MT5 credentials:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    fetchTrades,
    getTradeHistory,
    mt5Login
};
