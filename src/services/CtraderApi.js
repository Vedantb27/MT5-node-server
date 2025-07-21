const axios = require('axios');
const { formatHistory } = require('../utils/Cformatter');

const BASE_URL = 'http://localhost:9000'; // Your Flask server base URL

// Default time range: Jan 1, 1999 to Jan 1, 2025 (adjust as needed)
const DEFAULT_FROM = 915148800000;    // 1999-01-01
const DEFAULT_TO = 1767225600000;     // 2025-01-01

async function fetchDealHistory(accountId, from = DEFAULT_FROM, to = DEFAULT_TO) {
  const payload = {
    ctidTraderAccountId: accountId,
    fromTimestamp: from,
    toTimestamp: to,
    maxRows: 10000 // You can increase/decrease this
  };

  const res = await axios.post(`${BASE_URL}/deal-history`, payload);
  return res.data.deal || [];
}

async function fetchOrderHistory(accountId, from = DEFAULT_FROM, to = DEFAULT_TO) {
  const payload = {
    ctidTraderAccountId: accountId,
    fromTimestamp: from,
    toTimestamp: to
  };

  const res = await axios.post(`${BASE_URL}/order-history`, payload);
  console.log('Start logs from \n')
  console.log('Full response:', JSON.stringify(res.data, null, 2));
  console.log('res.data.order type', typeof res.data);
  console.log('Is Array', Array.isArray(res.data.order));
  console.log('Fetched orders:',res.data.order);
  return res.data.order || [];
}

async function fetchOrdersByPosition(accountId, positionId, from = DEFAULT_FROM, to = DEFAULT_TO) {
  const payload = {
    ctidTraderAccountId: accountId,
    positionId: positionId,
    fromTimestamp: from,
    toTimestamp: to
  };
  
  const res = await axios.post(`${BASE_URL}/OrderListByPosition`, payload);
  return res.data.order || [];
}

async function fetchSymbolMap(accountId){
  const res = await axios.post(`${BASE_URL}/SymbolsListReq`, { ctidTraderAccountId: accountId });
  
  const symbols = res.data.symbols || [];
  
  const symbolMap= {};
  symbols.forEach(sym => {
    symbolMap[parseInt(sym.symbolId)] = sym.symbolName;
  });

  return symbolMap;
}

async function fetchFormattedHistory(accountId) {
  const from = DEFAULT_FROM;
  const to = DEFAULT_TO;
 
 const [deals, orders, symbolMap] = await Promise.all([
    fetchDealHistory(accountId, from, to),
    fetchOrderHistory(accountId, from, to),
    fetchSymbolMap(accountId)
  ]);

  return formatHistory(deals, orders, symbolMap);
}

module.exports = {
  fetchFormattedHistory
};
