// Modified standalone API code (as BotController.js for integration)
// This has been refactored with dynamic namespace, removed redundant/unwanted endpoints (e.g., consolidated updates),
// added new endpoints as specified, and added validations.
// Unwanted: Removed generic update for running trades (split into specific ones), removed add spot-adds (now part of update),
// kept core GETs but made dynamic. Added spot update via index (assuming array index for identification).

const { body, validationResult, param, query } = require("express-validator");
const { v4: uuidv4 } = require("uuid");
const redis = require("redis");

// Redis client (will be passed or created per request in controller)
let client; // Initialize in main app or pass

// Dynamic namespace helper
function getNamespacedKey(req, baseKey) {
  const userId = req.user?.id;
  const accountNumber = req.body.accountNumber || req.query.accountNumber || req.params.accountNumber;
  if (!userId || !accountNumber) {
    throw new Error("Missing userId or accountNumber for namespace");
  }
  const namespace = `bot:${userId}:${accountNumber}:`;
  return `${namespace}${baseKey}`;
}

// Redis helpers (dynamic namespace via req)
async function addOrder(req, order) {
  const id = order.id;
  const key = getNamespacedKey(req, `order:${id}`);
  const pipeline = client.multi();
  for (const [k, v] of Object.entries(order)) {
    pipeline.hset(key, k, JSON.stringify(v));
  }
  pipeline.sadd(getNamespacedKey(req, "trading_orders_ids"), id);
  await pipeline.exec();
}

async function getOrder(req, id) {
  const key = getNamespacedKey(req, `order:${id}`);
  const data = await client.hGetAll(key);
  if (Object.keys(data).length === 0) return null;
  const orderObj = {};
  for (const [k, v] of Object.entries(data)) {
    orderObj[k] = JSON.parse(v);
  }
  return orderObj;
}

async function updateOrder(req, id, updates) {
  const key = getNamespacedKey(req, `order:${id}`);
  const pipeline = client.multi();
  for (const [k, v] of Object.entries(updates)) {
    pipeline.hset(key, k, JSON.stringify(v));
  }
  await pipeline.exec();
}

async function removeOrder(req, id) {
  const key = getNamespacedKey(req, `order:${id}`);
  await client.del(key);
  await client.sRem(getNamespacedKey(req, "trading_orders_ids"), id);
}

async function getAllOrders(req) {
  const ids = await client.sMembers(getNamespacedKey(req, "trading_orders_ids"));
  const orders = await Promise.all(ids.map((id) => getOrder(req, id)));
  return orders.filter(Boolean);
}

// Similar for running trades
async function addRunningTrade(req, trade) {
  const id = trade.id;
  const key = getNamespacedKey(req, `running_trade:${id}`);
  const pipeline = client.multi();
  for (const [k, v] of Object.entries(trade)) {
    pipeline.hset(key, k, JSON.stringify(v));
  }
  pipeline.sadd(getNamespacedKey(req, "running_trades_ids"), id);
  await pipeline.exec();
}

async function getRunningTrade(req, id) {
  const key = getNamespacedKey(req, `running_trade:${id}`);
  const data = await client.hGetAll(key);
  if (Object.keys(data).length === 0) return null;
  const tradeObj = {};
  for (const [k, v] of Object.entries(data)) {
    tradeObj[k] = JSON.parse(v);
  }
  return tradeObj;
}

async function updateRunningTrade(req, id, updates) {
  const key = getNamespacedKey(req, `running_trade:${id}`);
  const pipeline = client.multi();
  for (const [k, v] of Object.entries(updates)) {
    pipeline.hset(key, k, JSON.stringify(v));
  }
  await pipeline.exec();
}

async function removeRunningTrade(req, id) {
  const key = getNamespacedKey(req, `running_trade:${id}`);
  await client.del(key);
  await client.sRem(getNamespacedKey(req, "running_trades_ids"), id);
}

async function getAllRunningTrades(req) {
  const ids = await client.sMembers(getNamespacedKey(req, "running_trades_ids"));
  const trades = await Promise.all(ids.map((id) => getRunningTrade(req, id)));
  return trades.filter(Boolean);
}

// Removed orders helpers (kept minimal)
async function addRemovedOrder(req, order) {
  const id = order.id;
  const key = getNamespacedKey(req, `removed_order:${id}`);
  const pipeline = client.multi();
  for (const [k, v] of Object.entries(order)) {
    pipeline.hset(key, k, JSON.stringify(v));
  }
  pipeline.sadd(getNamespacedKey(req, "removed_orders_ids"), id);
  await pipeline.exec();
}

async function getAllRemovedOrders(req) {
  const ids = await client.sMembers(getNamespacedKey(req, "removed_orders_ids"));
  const orders = await Promise.all(ids.map((id) => {
    const key = getNamespacedKey(req, `removed_order:${id}`);
    return client.hGetAll(key).then(data => {
      if (Object.keys(data).length === 0) return null;
      const orderObj = {};
      for (const [k, v] of Object.entries(data)) {
        orderObj[k] = JSON.parse(v);
      }
      return orderObj;
    });
  }));
  return orders.filter(Boolean);
}

// Executed trades
async function appendExecutedTrade(req, trade) {
  await client.rPush(getNamespacedKey(req, "executed_orders"), JSON.stringify(trade));
}

async function getAllExecutedOrders(req) {
  const vals = await client.lRange(getNamespacedKey(req, "executed_orders"), 0, -1);
  return vals.map((v) => JSON.parse(v));
}

// Validation rules (consolidated and extended)
const baseOrderValidation = [
  body("accountNumber").isString().notEmpty().withMessage("Account number required"),
  body("symbol").isString().notEmpty().withMessage("Symbol required"),
  body("entry_type").isIn(["engulfing", "twoC", "BR"]).withMessage("Invalid entry type"),
  body("start_time").isISO8601().withMessage("Invalid start time"),
  body("trade_setup").isIn(["buy", "sell"]).withMessage("Invalid trade setup"),
  body("order_type").isIn(["limit", "stop"]).withMessage("Invalid order type"),
  body("checkOn").isArray({ min: 1 }).withMessage("checkOn required array"),
  body("checkOn.*").isIn(["1m", "5m", "15m", "30m", "1h", "2h", "4h", "1d", "1w", "1mn"]),
  body("risk_percentage").isFloat({ min: 0, max: 100 }).withMessage("Invalid risk %"),
  body("price").optional().isFloat({ min: 0 }),
  body("stopLoss").optional().isFloat({ min: 0 }),
  body("takeProfit").optional().isFloat({ min: 0 }),
  body("removalPrice").optional().isFloat({ min: 0 }),
  body("spot_adds").optional().isArray().withMessage("spot_adds must be array"),
  body("spot_adds.*").isObject().withMessage("Each spot add must be object"),
];

const spotAddValidation = [
  body("entry_price").isFloat({ min: 0 }).withMessage("Invalid entry price"),
  body("stoploss").isFloat({ min: 0 }).withMessage("Invalid stoploss"),
  body("risk_percentage").isFloat({ min: 0, max: 100 }).withMessage("Invalid risk %"),
  body("take_profit").optional().isFloat({ min: 0 }),
  body("order_id").optional().isString(),
];

const runningPartialCloseValidation = [
  body("accountNumber").isString().notEmpty(),
  body("partialClosePrice").optional().isFloat({ min: 0 }),
  body("lotToClose").optional().isFloat({ min: 0 }),
];

const runningSLTPBreakevenValidation = [
  body("accountNumber").isString().notEmpty(),
  body("slToUpdate").optional().isFloat({ min: 0 }),
  body("tpToUpdate").optional().isFloat({ min: 0 }),
  body("breakevenPrice").optional().isFloat({ min: 0 }),
];

const volumeToCloseValidation = [
  body("accountNumber").isString().notEmpty(),
  body("volumeToClose").isFloat({ min: 0 }).withMessage("volumeToClose must be positive"),
];

const deleteOrderValidation = [
  body("accountNumber").isString().notEmpty(),
];

// POST /api/bot/orders - Add new order (whole object)
const addOrderEndpoint = [
  ...baseOrderValidation,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const newOrder = {
        id: uuidv4(),
        symbol: req.body.symbol,
        start_time: req.body.start_time,
        trade_setup: req.body.trade_setup,
        checkOn: req.body.checkOn,
        risk_percentage: req.body.risk_percentage,
        entry_type: req.body.entry_type,
        order_type: req.body.order_type,
        price: req.body.price,
        stopLoss: req.body.stopLoss,
        takeProfit: req.body.takeProfit,
        removalPrice: req.body.removalPrice,
        spot_adds: req.body.spot_adds || [], // Allow spot_adds in order
        slToUpdate: req.body.stopLoss || 0.0,
        tpToUpdate: req.body.takeProfit || 0.0,
        order_id: null,
        volume: null,
      };
      await addOrder(req, newOrder);
      res.status(201).json({ message: "Order added", order: newOrder });
    } catch (error) {
      res.status(500).json({ message: "Error adding order", error: error.message });
    }
  }
];

// PUT /api/bot/orders/:id - Update pending order (whole object, no spot updates)
const updatePendingOrderEndpoint = [
  ...baseOrderValidation.filter(rule => !rule._config || !rule._config.field.includes('spot_adds')), // Exclude spot_adds
  param("id").isString().notEmpty(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const orderId = req.params.id;
      const existingOrder = await getOrder(req, orderId);
      if (!existingOrder) return res.status(404).json({ message: "Order not found" });

      // Whole object update (overwrite with provided fields, preserve others)
      const updates = { ...existingOrder, ...req.body };
      // Exclude spot_adds as per spec
      delete updates.spot_adds;
      if (req.body.stopLoss) updates.slToUpdate = req.body.stopLoss;
      if (req.body.takeProfit) updates.tpToUpdate = req.body.takeProfit;
      await updateOrder(req, orderId, updates);
      const updated = await getOrder(req, orderId);
      res.status(200).json({ message: "Order updated", order: updated });
    } catch (error) {
      res.status(500).json({ message: "Error updating order", error: error.message });
    }
  }
];

// PUT /api/bot/running-trades/:tradeId/spot-adds/:spotIndex - Update specific spot add (whole object)
const updateSpotAddEndpoint = [
  ...spotAddValidation,
  param("tradeId").isString().notEmpty(),
  param("spotIndex").isInt({ min: 0 }).withMessage("Valid spot index required"),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const tradeId = req.params.tradeId;
      const spotIndex = parseInt(req.params.spotIndex);
      const trade = await getRunningTrade(req, tradeId);
      if (!trade) return res.status(404).json({ message: "Running trade not found" });

      let spot_adds = trade.spot_adds || [];
      if (spotIndex >= spot_adds.length) return res.status(400).json({ message: "Spot index out of bounds" });

      // Whole object update for this spot
      spot_adds[spotIndex] = { ...spot_adds[spotIndex], ...req.body };
      await updateRunningTrade(req, tradeId, { spot_adds });
      res.status(200).json({ message: "Spot add updated", spot_add: spot_adds[spotIndex] });
    } catch (error) {
      res.status(500).json({ message: "Error updating spot add", error: error.message });
    }
  }
];

// PUT /api/bot/running-trades/:id/partial-close - Update partialClosePrice, lotToClose
const updatePartialCloseEndpoint = [
  ...runningPartialCloseValidation,
  param("id").isString().notEmpty(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const tradeId = req.params.id;
      const trade = await getRunningTrade(req, tradeId);
      if (!trade) return res.status(404).json({ message: "Running trade not found" });

      const updates = {};
      if ("partialClosePrice" in req.body) updates.partialClosePrice = req.body.partialClosePrice;
      if ("lotToClose" in req.body) updates.lotToClose = req.body.lotToClose;
      await updateRunningTrade(req, tradeId, updates);
      res.status(200).json({ message: "Partial close updated" });
    } catch (error) {
      res.status(500).json({ message: "Error updating partial close", error: error.message });
    }
  }
];

// PUT /api/bot/running-trades/:id/sltp-breakeven - Update slToUpdate, tpToUpdate, breakevenPrice
const updateSLTPBreakevenEndpoint = [
  ...runningSLTPBreakevenValidation,
  param("id").isString().notEmpty(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const tradeId = req.params.id;
      const trade = await getRunningTrade(req, tradeId);
      if (!trade) return res.status(404).json({ message: "Running trade not found" });

      const updates = {};
      if ("slToUpdate" in req.body) updates.slToUpdate = req.body.slToUpdate;
      if ("tpToUpdate" in req.body) updates.tpToUpdate = req.body.tpToUpdate;
      if ("breakevenPrice" in req.body) updates.breakevenPrice = req.body.breakevenPrice;
      await updateRunningTrade(req, tradeId, updates);
      res.status(200).json({ message: "SL/TP/Breakeven updated" });
    } catch (error) {
      res.status(500).json({ message: "Error updating SL/TP/Breakeven", error: error.message });
    }
  }
];

// POST /api/bot/running-trades/:id/volume-to-close - Set volumeToClose with validation
const setVolumeToCloseEndpoint = [
  ...volumeToCloseValidation,
  param("id").isString().notEmpty(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const tradeId = req.params.id;
      const trade = await getRunningTrade(req, tradeId);
      if (!trade) return res.status(404).json({ message: "Running trade not found" });

      const volumeToClose = parseFloat(req.body.volumeToClose);
      const currentVolume = parseFloat(trade.volume || 0);

      if (volumeToClose > currentVolume) {
        return res.status(400).json({ message: "volumeToClose cannot exceed current volume" });
      }
      if (volumeToClose <= 0) {
        return res.status(400).json({ message: "volumeToClose must be positive" });
      }

      await updateRunningTrade(req, tradeId, { volumeToClose });
      res.status(200).json({ message: "Volume to close set", volumeToClose });
    } catch (error) {
      res.status(500).json({ message: "Error setting volume to close", error: error.message });
    }
  }
];

// POST /api/bot/orders-to-delete - Add to orders_to_delete set
const addToDeleteEndpoint = [
  ...deleteOrderValidation,
  body("orderId").isString().notEmpty().withMessage("orderId required"),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const orderId = req.body.orderId;
      await client.sAdd(getNamespacedKey(req, "orders_to_delete"), orderId);
      res.status(200).json({ message: "Order added to delete queue" });
    } catch (error) {
      res.status(500).json({ message: "Error adding to delete", error: error.message });
    }
  }
];

// GET endpoints (dynamic)
const getAllOrdersEndpoint = [
  query("accountNumber").isString().notEmpty(),
  async (req, res) => {
    try {
      const orders = await getAllOrders(req);
      res.status(200).json(orders);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
];

const getAllRunningTradesEndpoint = getAllOrdersEndpoint.map(rule => rule); // Reuse, adjust field if needed
getAllRunningTradesEndpoint[0] = query("accountNumber").isString().notEmpty(); // Same
const getAllRunningTradesHandler = async (req, res) => {
  try {
    const trades = await getAllRunningTrades(req);
    res.status(200).json(trades);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAllExecutedOrdersEndpoint = getAllOrdersEndpoint.map(rule => rule);
const getAllExecutedOrdersHandler = async (req, res) => {
  try {
    const executed = await getAllExecutedOrders(req);
    res.status(200).json(executed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAllRemovedOrdersEndpoint = getAllOrdersEndpoint.map(rule => rule);
const getAllRemovedOrdersHandler = async (req, res) => {
  try {
    const removed = await getAllRemovedOrders(req);
    res.status(200).json(removed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// DELETE /api/bot/orders/:id - Trigger delete
const deleteOrderEndpoint = [
  ...deleteOrderValidation,
  param("id").isString().notEmpty(),
  async (req, res) => {
    try {
      const orderId = req.params.id;
      const order = await getOrder(req, orderId);
      if (!order) return res.status(404).json({ message: "Order not found" });

      if (order.order_id) {
        await client.sAdd(getNamespacedKey(req, "orders_to_delete"), order.order_id);
      }
      await removeOrder(req, orderId);
      res.status(200).json({ message: "Deletion triggered" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
];

// DELETE /api/bot/running-trades/:id - Trigger close
const deleteRunningTradeEndpoint = deleteOrderEndpoint.map(rule => rule); // Reuse
deleteRunningTradeEndpoint[deleteOrderEndpoint.length - 1] = async (req, res) => {
  try {
    const tradeId = req.params.id;
    const trade = await getRunningTrade(req, tradeId);
    if (!trade) return res.status(404).json({ message: "Trade not found" });

    await client.sAdd(getNamespacedKey(req, "orders_to_delete"), tradeId);
    await removeRunningTrade(req, tradeId);
    res.status(200).json({ message: "Closure triggered" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Export for controller
module.exports = {
  addOrder: addOrderEndpoint,
  updatePendingOrder: updatePendingOrderEndpoint,
  updateSpotAdd: updateSpotAddEndpoint,
  updatePartialClose: updatePartialCloseEndpoint,
  updateSLTPBreakeven: updateSLTPBreakevenEndpoint,
  setVolumeToClose: setVolumeToCloseEndpoint,
  addToDelete: addToDeleteEndpoint,
  getAllOrders: getAllOrdersEndpoint,
//   getAllOrdersHandler,
  getAllRunningTrades: getAllRunningTradesEndpoint,
  getAllRunningTradesHandler,
  getAllExecutedOrders: getAllExecutedOrdersEndpoint,
  getAllExecutedOrdersHandler,
  getAllRemovedOrders: getAllRemovedOrdersEndpoint,
  getAllRemovedOrdersHandler,
  deleteOrder: deleteOrderEndpoint,
  deleteRunningTrade: deleteRunningTradeEndpoint,
  // Pass client if needed
  setRedisClient: (c) => { client = c; }
};