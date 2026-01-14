// src/routes/copyTradeRoutes.js
const express = require('express');
const CopyTradeController = require('../controllers/CopyTradeController');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

router.use(authMiddleware);

router.post('/link-slave', CopyTradeController.linkSlaveToMaster);
router.post('/unlink-slave', CopyTradeController.unlinkSlaveFromMaster);
router.post('/set-paused', CopyTradeController.setSlavePaused);
router.post('/set-multiplier', CopyTradeController.setMultiplier);
router.post('/set-symbol-map', CopyTradeController.setSymbolMap);
router.post('/edit-symbol-map', CopyTradeController.editSymbolMap);
router.post('/delete-symbol-map', CopyTradeController.deleteSymbolMap);
router.post('/set-common-aliases', CopyTradeController.setCommonAliases);
router.get('/get-slaves', CopyTradeController.getSlavesForMaster);
router.get('/get-slave-config', CopyTradeController.getSlaveConfig);
router.get('/get-symbol-map', CopyTradeController.getSymbolMap);
router.get('/get-common-aliases', CopyTradeController.getCommonAliases);
router.get('/get-account-symbols', CopyTradeController.getAccountSymbols);
router.post('/create-master', CopyTradeController.createMaster);

module.exports = router;