const express = require('express');
const tradeController = require('../controllers/tradeController');
const calendarEvents = require('../controllers/calendarController')

const router = express.Router();

router.post('/fetch-trades', tradeController.fetchTrades);
router.get('/trade-history', tradeController.getTradeHistory);
router.post('/mt5-login', tradeController.mt5Login);
router.post('/add-notes', calendarEvents.addNotes);
router.delete('/delete-notes', calendarEvents.deleteNotes);
router.get('/get-notes', calendarEvents.getNotes);
module.exports = router;
