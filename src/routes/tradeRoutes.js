const express = require('express');
const tradeController = require('../controllers/tradeController');

const router = express.Router();

router.post('/fetch-trades', tradeController.fetchTrades);
router.get('/trade-history', tradeController.getTradeHistory);
router.post('/mt5-login', tradeController.mt5Login);
module.exports = router;
