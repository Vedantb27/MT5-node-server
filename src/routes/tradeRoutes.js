const express = require('express');
const tradeController = require('../controllers/tradeController');
const calendarEvents = require('../controllers/calendarController');
const mt5AccountController = require('../controllers/mt5AccountController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.post('/fetch-trades', tradeController.fetchTrades);
router.get('/trade-history', tradeController.getTradeHistory);
router.post('/mt5-login', tradeController.mt5Login);
router.post('/add-notes', calendarEvents.addNotes);
router.delete('/delete-notes', calendarEvents.deleteNotes);
router.get('/get-notes', calendarEvents.getNotes);

// MT5 account routes
router.get('/mt5-accounts', mt5AccountController.getMT5Accounts);
router.post('/mt5-accounts', mt5AccountController.addMT5Account);

module.exports = router;