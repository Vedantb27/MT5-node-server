const express = require('express');
const router = express.Router();
const { fetchFormattedHistory } = require('../services/CtraderApi');

// Core function to fetch history
async function getMyFxbookHistory(ctidTraderAccountId,userId,accountNumber) {
  if (!ctidTraderAccountId) {
    return { success: false, status: 400, error: 'Missing ctidTraderAccountId' };
  }

  try {
    const history = await fetchFormattedHistory(ctidTraderAccountId,userId,accountNumber);
    return { success: true, status: 200, data: history };
  } catch (err) {
    console.error('fetchHisError:', err);
    return { success: false, status: 500, error: 'Internal Server Error' };
  }
}

// Express route
router.post('/myfxbook-history', async (req, res) => {
  const { ctidTraderAccountId } = req.body;
  const result = await getMyFxbookHistory(ctidTraderAccountId);
  res.status(result.status).json(result.success ? result.data : { error: result.error });
});

module.exports = {
  router,
  getMyFxbookHistory
};
