const express = require('express');
const router = express.Router();
const { fetchFormattedHistory } = require('../services/CtraderApi');
const { isAuthenticated } = require('../middleware/CauthMiddleware');

router.post('/myfxbook-history', isAuthenticated, async (req, res) => {
  try {
    const { ctidTraderAccountId } = req.body;

    if (!ctidTraderAccountId) {
      return res.status(400).json({ error: 'Missing ctidTraderAccountId' });
    }

    const history = await fetchFormattedHistory(ctidTraderAccountId);
    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
