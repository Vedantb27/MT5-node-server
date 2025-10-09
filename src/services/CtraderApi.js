const axios = require('axios');
const { formatHistory } = require('../utils/Cformatter');

const BASE_URL = 'http://localhost:5000'; // Your Flask server base URL

const DEFAULT_FROM = 915148800000;    // 1999-01-01
const DEFAULT_TO = Date.now();

async function fetchDealHistory(accountId, from = DEFAULT_FROM, to = DEFAULT_TO) {
  const payload = {
     ctidTraderAccountId: String(accountId), // Convert to string
    fromTimestamp: String(from),            // Convert to string
    toTimestamp: String(to), 
    maxRows: 10000
  };

  try {
    const res = await axios.post(`${BASE_URL}/deal-list`, payload);
    console.log(res,"mainmain")
    return res.data.deals || [];
  } catch (error) {
    console.error('Error fetching deal history:', error.message);
    throw new Error('Failed to fetch deal history');
  }
}

async function fetchOrderHistory(accountId, from = DEFAULT_FROM, to = DEFAULT_TO) {
  const payload = {
    ctidTraderAccountId:String(accountId),
    fromTimestamp: String(from),
    toTimestamp:String(to)
  };

  try {
    const res = await axios.post(`${BASE_URL}/order-list`, payload);
    return res.data.orders || [];
  } catch (error) {
    console.error('Error fetching order history:', error.message);
    throw new Error('Failed to fetch order history');
  }
}

async function fetchOrdersByPosition(accountId, positionId, from = DEFAULT_FROM, to = DEFAULT_TO) {
  const payload = {
    ctidTraderAccountId: accountId,
    positionId: positionId,
    fromTimestamp: from,
    toTimestamp: to
  };

  try {
    const res = await axios.post(`${BASE_URL}/OrderListByPosition`, payload);
    return res.data.order || [];
  } catch (error) {
    console.error('Error fetching orders by position:', error.message);
    throw new Error('Failed to fetch orders by position');
  }
}

async function fetchSymbolMap(accountId) {
  try {
    const res = await axios.post(`${BASE_URL}/symbol-list`, { ctidTraderAccountId:String(accountId)});
    const symbols = res.data.symbols || [];

    const symbolMap = {};
    symbols.forEach(sym => {
      symbolMap[parseInt(sym.symbolId)] = sym.symbolName;
    });

    console.log('symbolMap', symbolMap);
    return symbolMap;
  } catch (error) {
    console.error('Error fetching symbol map:', error.message);
    throw new Error('Failed to fetch symbol map');
  }
}

async function fetchFormattedHistory(accountId,userId,accountNumber) {
  const from = DEFAULT_FROM;
  const to = DEFAULT_TO;

  try {
    const [deals, orders, symbolMap] = await Promise.all([
      fetchDealHistory(accountId, from, to),
      fetchOrderHistory(accountId, from, to),
      fetchSymbolMap(accountId)
    ]);

    return await formatHistory(deals, orders, symbolMap,accountId,userId,accountNumber);
  } catch (error) {
    console.error('Error fetching formatted history:', error.message);
    throw new Error('Failed to fetch formatted trade history');
  }
}

module.exports = {
  fetchFormattedHistory
};
