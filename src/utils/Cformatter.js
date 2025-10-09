const dayjs = require('dayjs');
const { DataTypes, INTEGER, NUMBER } = require('sequelize');
const sequelize = require('../config/database');


function msToDate(ms) {
  return dayjs(ms).format('DD.MM.YYYY HH:mm');
}

function formatDuration(openMs, closeMs) {
  const diff = closeMs - openMs;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${mins}m`;
}

function formatDurationSeconds(openMs, closeMs) {
  const diff = closeMs - openMs;
  return (diff / 1000).toFixed(0); // Duration in seconds
}

// Define the trade model dynamically for a given userId
function defineTradeModel(userId) {
  return sequelize.define(
    `${userId}_trades`,
    {
      sr_no: { type: DataTypes.INTEGER, autoIncrement: true },
      accountId: { type: DataTypes.STRING, allowNull: true, },
      accountNumber: { type: DataTypes.BIGINT, allowNull: false },
      position_id: { type: DataTypes.INTEGER, primaryKey: true, unique: true, allowNull: false },
      open_date: { type: DataTypes.DATEONLY, allowNull: false },
      open_time: { type: DataTypes.TIME, allowNull: false },
      close_date: { type: DataTypes.DATEONLY, allowNull: false },
      close_time: { type: DataTypes.TIME, allowNull: false },
      trade_duration: { type: DataTypes.STRING, allowNull: false },
      trade_duration_seconds: { type: DataTypes.STRING, allowNull: false },
      open_price: { type: DataTypes.FLOAT, allowNull: false },
      close_price: { type: DataTypes.FLOAT, allowNull: false },
      no_of_deals: { type: DataTypes.FLOAT, allowNull: false },
      profit: { type: DataTypes.FLOAT, allowNull: false },
      sl_price: { type: DataTypes.FLOAT, allowNull: true },
      tp_price: { type: DataTypes.FLOAT, allowNull: true },
      swap: { type: DataTypes.FLOAT, allowNull: false },
      commission: { type: DataTypes.FLOAT, allowNull: false },
      type: { type: DataTypes.STRING, allowNull: false },
      symbol: { type: DataTypes.STRING, allowNull: false },
      volume: { type: DataTypes.FLOAT, allowNull: false },
      history_from_date: { type: DataTypes.DATEONLY, allowNull: false },
      history_to_date: { type: DataTypes.DATEONLY, allowNull: false },
    },
    {
      tableName: `${userId}_trades`,
      timestamps: true,
    }
  );
}

async function formatHistory(deals, orders, symbolMap = {}, accountId, userId, accountNumber) {
  const closedOrders = orders.filter((o) => o.closingOrder);
  const openOrders = orders.filter((o) => !o.closingOrder);

  // Define the trade model for the specific user
  const Trade = defineTradeModel(userId);

  // Ensure the table exists (create if it doesn't)
  await Trade.sync();

  const formattedTrades = closedOrders.map(async (closedOrder) => {
    const posId = closedOrder.positionId;

    const entryOrder = openOrders.find((o) => o.positionId === posId);
    const deal = deals.find((d) => d.positionId === posId && d.dealStatus === 'Filled');

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

    const openDateTime = msToDate(openTimestamp).split(' ');
    const closeDateTime = msToDate(closeTimestamp).split(' ');
    console.log('accounId', accountId,);
    console.log('\n accountNumber', accountNumber,);
    const tradeData = {
      accountId: BigInt(accountId),
      accountNumber: BigInt(accountNumber),
      position_id: posId,
      open_date: openDateTime[0].split('.').reverse().join('-'), // Convert DD.MM.YYYY to YYYY-MM-DD
      open_time: openDateTime[1],
      close_date: closeDateTime[0].split('.').reverse().join('-'), // Convert DD.MM.YYYY to YYYY-MM-DD
      close_time: closeDateTime[1],
      trade_duration: formatDuration(openTimestamp, closeTimestamp),
      trade_duration_seconds: formatDurationSeconds(openTimestamp, closeTimestamp),
      open_price: parseFloat(openPrice),
      close_price: parseFloat(closePrice),
      no_of_deals: 1, // Assuming one deal per closed order
      profit: parseFloat(profit)/100,
      sl_price: null, // Not provided in original data
      tp_price: null, // Not provided in original data
      type: action,
      symbol,
      swap:deal.closePositionDetail.swap/100,
      commission:deal.closePositionDetail.commission/100,
      volume: parseFloat(lots),
      history_from_date: openDateTime[0].split('.').reverse().join('-'), // Use open_date as default
      history_to_date: closeDateTime[0].split('.').reverse().join('-'), // Use close_date as default
    };

    // Store the trade in the database
    await Trade.create(tradeData);

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
      'Risk Reward': '-',
    };
  });

  // Wait for all trades to be processed and filter out null results
  const results = await Promise.all(formattedTrades);
  return results.filter(Boolean);
}

function mapSymbol(symbolId) {
  const symbols = {
    5: 'USDCAD',
    // Add more as needed
  };
  return symbols[symbolId] || `Symbol#${symbolId}`;
}

module.exports = {
  formatHistory,
};