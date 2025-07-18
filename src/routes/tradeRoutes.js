const express = require('express');
const tradeController = require('../controllers/tradeController');
const calendarEvents = require('../controllers/calendarController');
const AccountController = require('../controllers/AccountController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.post('/fetch-trades', tradeController.fetchTrades);
router.get('/trade-history', tradeController.getTradeHistory);
router.post('/add-notes', calendarEvents.addNotes);
router.delete('/delete-notes', calendarEvents.deleteNotes);
router.get('/get-notes', calendarEvents.getNotes);

// Accounts routes
router.get('/trading-accounts', AccountController.getAccounts);
router.post('/trading-accounts', AccountController.addAccount);

module.exports = router;