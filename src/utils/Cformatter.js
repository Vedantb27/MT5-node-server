const dayjs = require('dayjs');

function msToDate(ms) {
  return dayjs(ms).format('DD.MM.YYYY HH:mm');
}

function formatDuration(openMs, closeMs) {
  const diff = closeMs - openMs;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${mins}m`;
}

function formatHistory(deals, orders, symbolMap = {}) {
  const closedOrders = orders.filter(o => o.closingOrder);
  const openOrders = orders.filter(o => !o.closingOrder);

  return closedOrders.map(closedOrder => {
    const posId = closedOrder.positionId;

    const entryOrder = openOrders.find(o => o.positionId === posId);
    const deal = deals.find(d => d.positionId === posId && d.dealStatus === 'FILLED');

    if (!entryOrder || !deal) return null;

    const openTimestamp = entryOrder.tradeData.openTimestamp;
    const closeTimestamp = closedOrder.utcLastUpdateTimestamp;

    const openPrice = entryOrder.executionPrice;
    const closePrice = closedOrder.executionPrice;

    const symbolId = entryOrder.tradeData.symbolId;
    const symbol = symbolMap[symbolId] || `Symbol#${symbolId}`;

    const action = entryOrder.tradeData.tradeSide;
    const lots = entryOrder.tradeData.volume / 100000;
    const pips = ((closePrice - openPrice) * 10000 * (action === 'SELL' ? -1 : 1)).toFixed(1);

    const profit = deal?.closePositionDetail
      ? (
          parseFloat(deal.closePositionDetail.grossProfit) +
          parseFloat(deal.closePositionDetail.commission) +
          parseFloat(deal.closePositionDetail.swap)
        ).toFixed(2)
      : 0;

    return {
      'position id': posId,
      'Open Date': msToDate(openTimestamp),
      'Close Date': msToDate(closeTimestamp),
      'Symbol': symbol,
      'Action': action,
      'Lots': lots,
      'SL (Price)': '-',
      'TP (Price)': '-',
      'Open Price': openPrice,
      'Close Price': closePrice,
      'Pips': parseFloat(pips),
      'Net Profit': parseFloat(profit),
      'Duration': formatDuration(openTimestamp, closeTimestamp),
      'Gain': '-',
      'Risk Reward': '-'
    };
  }).filter(Boolean);
}


function mapSymbol(symbolId) {
  const symbols = {
    5: 'USDCAD',
    // Add more as needed
  };
  return symbols[symbolId] || `Symbol#${symbolId}`;
}

module.exports = {
  formatHistory
};
