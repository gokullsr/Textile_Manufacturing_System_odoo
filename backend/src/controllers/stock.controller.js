/**
 * Material Stock Controller.
 * Comprehensive inventory management with sector breakdowns, atomic concurrency guards,
 * negative-stock prevention, and append-only movement ledger auditing.
 */
const { MaterialStock, MaterialMovement } = require('../models');
const { calculateStockMetrics, escapeRegex } = require('../utils/derivedMetrics');

/**
 * Validates non-negative quantity with at most 3 decimal precision.
 */
const validateStockQuantity = (qty, allowZero = false) => {
  const num = Number(qty);
  if (isNaN(num)) return { valid: false, error: 'Quantity must be a valid number' };
  if (allowZero ? num < 0 : num <= 0) return { valid: false, error: `Quantity must be ${allowZero ? 'non-negative' : 'greater than zero'}` };
  if (num > 10000000) return { valid: false, error: 'Quantity exceeds maximum allowable threshold' };

  // Check max 3 decimal places
  const parts = num.toString().split('.');
  if (parts.length === 2 && parts[1].length > 3) {
    return { valid: false, error: 'Quantity cannot exceed 3 decimal places of precision' };
  }

  return { valid: true, value: num };
};

/**
 * GET /api/stock
 * Returns inventory items with derived stock levels, search, and sector/category filters.
 */
const getStock = async (req, res, next) => {
  try {
    const { level, category, sector, search } = req.query;

    const query = {};

    if (category) {
      query.category = category;
    }

    if (sector) {
      query.sector = sector;
    }

    if (search && search.trim()) {
      const escaped = escapeRegex(search.trim());
      query.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { sku: { $regex: escaped, $options: 'i' } },
        { supplier: { $regex: escaped, $options: 'i' } },
      ];
    }

    const items = await MaterialStock.find(query).sort('sku').lean();

    let stockList = items.map((item) => {
      const metrics = calculateStockMetrics(item);
      const suggestedReorder = metrics.shortfall > 0 ? metrics.shortfall + Math.ceil(item.reorderLevel * 0.5) : 0;
      return {
        ...item,
        category: item.category || 'general',
        sector: item.sector || 'general',
        ...metrics,
        suggestedReorderQuantity: suggestedReorder,
      };
    });

    // Optional level filtering
    if (level === 'low') {
      stockList = stockList.filter((item) => item.stockLevel === 'low');
    } else if (level === 'out') {
      stockList = stockList.filter((item) => item.stockLevel === 'out');
    } else if (level === 'warning') {
      stockList = stockList.filter((item) => item.stockLevel === 'low' || item.stockLevel === 'out');
    } else if (level === 'ok') {
      stockList = stockList.filter((item) => item.stockLevel === 'ok');
    }

    // Default sorting: OUT first, then LOW with highest shortfall, then OK
    stockList.sort((a, b) => {
      const priority = { out: 0, low: 1, ok: 2 };
      if (priority[a.stockLevel] !== priority[b.stockLevel]) {
        return priority[a.stockLevel] - priority[b.stockLevel];
      }
      return b.shortfall - a.shortfall;
    });

    const outOfStockCount = items.filter((i) => (Number(i.quantityOnHand) || 0) <= 0).length;
    const lowStockCount = items.filter((i) => {
      const qty = Number(i.quantityOnHand) || 0;
      const reorder = Number(i.reorderLevel) || 0;
      return qty > 0 && qty <= reorder;
    }).length;
    const okStockCount = items.length - outOfStockCount - lowStockCount;

    return res.status(200).json({
      stock: stockList,
      total: stockList.length,
      outOfStockCount,
      lowStockCount,
      okStockCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/stock/summary
 * Single source of truth for plant inventory health, sector cards, needs-attention list, and recent movements.
 */
const getStockSummary = async (req, res, next) => {
  try {
    const [items, recentMovements] = await Promise.all([
      MaterialStock.find().sort('sku').lean(),
      MaterialMovement.find().sort('-timestamp').limit(15).lean(),
    ]);

    const enrichedItems = items.map((item) => {
      const metrics = calculateStockMetrics(item);
      const suggestedReorder = metrics.shortfall > 0 ? metrics.shortfall + Math.ceil(item.reorderLevel * 0.5) : 0;
      return {
        ...item,
        category: item.category || 'general',
        sector: item.sector || 'general',
        ...metrics,
        suggestedReorderQuantity: suggestedReorder,
      };
    });

    // Needs attention list (OUT first, then LOW by highest shortfall)
    const needsAttention = enrichedItems
      .filter((i) => i.stockLevel === 'out' || i.stockLevel === 'low')
      .sort((a, b) => {
        const priority = { out: 0, low: 1, ok: 2 };
        if (priority[a.stockLevel] !== priority[b.stockLevel]) {
          return priority[a.stockLevel] - priority[b.stockLevel];
        }
        return b.shortfall - a.shortfall;
      });

    // Per-sector metrics with totals segregated strictly per unit (never cross-summed)
    const sectors = ['spinning', 'weaving', 'dyeing', 'finishing', 'general'];
    const perSector = {};

    sectors.forEach((sec) => {
      const sectorItems = enrichedItems.filter((i) => i.sector === sec);
      const unitTotals = {};

      sectorItems.forEach((item) => {
        const unit = item.unit || 'kg';
        unitTotals[unit] = (unitTotals[unit] || 0) + (Number(item.quantityOnHand) || 0);
      });

      perSector[sec] = {
        totalItems: sectorItems.length,
        outCount: sectorItems.filter((i) => i.stockLevel === 'out').length,
        lowCount: sectorItems.filter((i) => i.stockLevel === 'low').length,
        okCount: sectorItems.filter((i) => i.stockLevel === 'ok').length,
        unitTotals,
      };
    });

    const outOfStockCount = needsAttention.filter((i) => i.stockLevel === 'out').length;
    const lowStockCount = needsAttention.filter((i) => i.stockLevel === 'low').length;
    const okStockCount = items.length - outOfStockCount - lowStockCount;

    return res.status(200).json({
      totalItems: items.length,
      outOfStockCount,
      lowStockCount,
      okStockCount,
      perSector,
      needsAttention,
      recentMovements,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/stock
 * Creates a new material stock item (Owner only).
 */
const createStock = async (req, res, next) => {
  try {
    const { name, sku, quantityOnHand, unit = 'kg', reorderLevel = 100, supplier = '', category = 'general', sector = 'general' } = req.body;

    if (!name || name.trim() === '') {
      return res.status(422).json({
        error: { message: 'Material name is required', code: 'MISSING_NAME' },
      });
    }

    if (!sku || sku.trim() === '') {
      return res.status(422).json({
        error: { message: 'Material SKU / Code is required', code: 'MISSING_SKU' },
      });
    }

    const normalizedSku = sku.trim().toUpperCase();
    const existing = await MaterialStock.findOne({ sku: normalizedSku });
    if (existing) {
      return res.status(409).json({
        error: {
          message: `Material stock with SKU '${normalizedSku}' already exists`,
          code: 'DUPLICATE_SKU',
        },
      });
    }

    const qtyCheck = validateStockQuantity(quantityOnHand ?? 0, true);
    if (!qtyCheck.valid) {
      return res.status(422).json({
        error: { message: qtyCheck.error, code: 'INVALID_QUANTITY' },
      });
    }

    const reorderCheck = validateStockQuantity(reorderLevel ?? 100, true);
    if (!reorderCheck.valid) {
      return res.status(422).json({
        error: { message: reorderCheck.error, code: 'INVALID_REORDER_LEVEL' },
      });
    }

    const item = new MaterialStock({
      name: name.trim(),
      sku: normalizedSku,
      category,
      sector,
      quantityOnHand: qtyCheck.value,
      unit,
      reorderLevel: reorderCheck.value,
      supplier: supplier.trim(),
    });

    await item.save();

    // If initial stock > 0, write initial ledger movement
    if (qtyCheck.value > 0) {
      const movement = new MaterialMovement({
        material: item._id,
        sku: item.sku,
        type: 'RECEIVE',
        quantityDelta: qtyCheck.value,
        quantityBefore: 0,
        quantityAfter: qtyCheck.value,
        unit: item.unit,
        reason: 'Initial inventory registration',
        actor: {
          userId: req.user?._id,
          name: req.user?.name || 'Factory Owner',
          role: req.user?.role || 'owner',
        },
      });
      await movement.save();
    }

    const metrics = calculateStockMetrics(item.toObject());

    return res.status(201).json({
      stock: {
        ...item.toObject(),
        ...metrics,
      },
      message: `Material ${item.sku} registered successfully.`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/stock/:id
 * Updates material metadata or reorder thresholds (Owner only).
 */
const updateStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, supplier, reorderLevel, category, sector } = req.body;

    const item = await MaterialStock.findById(id);
    if (!item) {
      return res.status(404).json({
        error: { message: 'Material stock item not found', code: 'STOCK_NOT_FOUND' },
      });
    }

    if (name && name.trim()) item.name = name.trim();
    if (supplier !== undefined) item.supplier = supplier.trim();
    if (category) item.category = category;
    if (sector) item.sector = sector;

    if (reorderLevel !== undefined) {
      const reorderCheck = validateStockQuantity(reorderLevel, true);
      if (!reorderCheck.valid) {
        return res.status(422).json({
          error: { message: reorderCheck.error, code: 'INVALID_REORDER_LEVEL' },
        });
      }
      item.reorderLevel = reorderCheck.value;
    }

    await item.save();
    const metrics = calculateStockMetrics(item.toObject());

    return res.status(200).json({
      stock: {
        ...item.toObject(),
        ...metrics,
      },
      message: `Material ${item.sku} updated successfully.`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/stock/:id
 * Deletes a material stock item (Owner only).
 */
const deleteStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await MaterialStock.findById(id);
    if (!item) {
      return res.status(404).json({
        error: { message: 'Material stock item not found', code: 'STOCK_NOT_FOUND' },
      });
    }

    await MaterialStock.deleteOne({ _id: item._id });

    return res.status(200).json({
      success: true,
      message: `Material ${item.sku} (${item.name}) removed from stock.`,
      deletedId: id,
      deletedSku: item.sku,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/stock/:id/receive
 * Receives additional stock quantity and appends immutable ledger movement (Owner & Manager).
 */
const receiveStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { quantity, notes = '' } = req.body || {};

    const qtyCheck = validateStockQuantity(quantity, false);
    if (!qtyCheck.valid) {
      return res.status(422).json({
        error: { message: qtyCheck.error, code: 'INVALID_QUANTITY' },
      });
    }

    const item = await MaterialStock.findById(id);
    if (!item) {
      return res.status(404).json({
        error: { message: 'Material stock item not found', code: 'STOCK_NOT_FOUND' },
      });
    }

    const quantityBefore = Number(item.quantityOnHand);
    const quantityDelta = qtyCheck.value;
    const quantityAfter = Math.round((quantityBefore + quantityDelta) * 1000) / 1000;

    item.quantityOnHand = quantityAfter;
    if (item.isOrdered && item.quantityOnHand >= item.reorderLevel) {
      item.isOrdered = false;
      item.orderedQuantity = 0;
    }
    await item.save();

    const movement = new MaterialMovement({
      material: item._id,
      sku: item.sku,
      type: 'RECEIVE',
      quantityDelta,
      quantityBefore,
      quantityAfter,
      unit: item.unit,
      reason: notes.trim() || 'Stock receipt',
      actor: {
        userId: req.user?._id,
        name: req.user?.name || 'Operator',
        role: req.user?.role || 'manager',
      },
    });

    await movement.save();
    const metrics = calculateStockMetrics(item.toObject());

    return res.status(200).json({
      stock: { ...item.toObject(), ...metrics },
      movement,
      message: `Successfully received ${quantityDelta} ${item.unit} of ${item.sku}.`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/stock/:id/use
 * Consumes stock with atomic non-negative guard and ledger movement (Owner & Manager).
 */
const useStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { quantity, notes = '', orderNumber = null } = req.body || {};

    const qtyCheck = validateStockQuantity(quantity, false);
    if (!qtyCheck.valid) {
      return res.status(422).json({
        error: { message: qtyCheck.error, code: 'INVALID_QUANTITY' },
      });
    }

    const qtyToDeduct = qtyCheck.value;

    // Atomic conditional decrement: only succeeds if current quantityOnHand >= qtyToDeduct
    const updatedItem = await MaterialStock.findOneAndUpdate(
      {
        _id: id,
        quantityOnHand: { $gte: qtyToDeduct },
      },
      {
        $inc: { quantityOnHand: -qtyToDeduct },
      },
      { new: true }
    );

    if (!updatedItem) {
      const existing = await MaterialStock.findById(id);
      if (!existing) {
        return res.status(404).json({
          error: { message: 'Material stock item not found', code: 'STOCK_NOT_FOUND' },
        });
      }

      return res.status(409).json({
        error: {
          message: `Insufficient stock on hand for ${existing.sku}. Requested: ${qtyToDeduct} ${existing.unit}, Available: ${existing.quantityOnHand} ${existing.unit}.`,
          code: 'INSUFFICIENT_STOCK',
        },
      });
    }

    const quantityAfter = Number(updatedItem.quantityOnHand);
    const quantityBefore = Math.round((quantityAfter + qtyToDeduct) * 1000) / 1000;

    const movement = new MaterialMovement({
      material: updatedItem._id,
      sku: updatedItem.sku,
      type: orderNumber ? 'ORDER_DEDUCT' : 'USE',
      quantityDelta: -qtyToDeduct,
      quantityBefore,
      quantityAfter,
      unit: updatedItem.unit,
      reason: notes.trim() || (orderNumber ? `Production consumption for ${orderNumber}` : 'Factory operations usage'),
      orderNumber: orderNumber ? orderNumber.trim().toUpperCase() : null,
      actor: {
        userId: req.user?._id,
        name: req.user?.name || 'Operator',
        role: req.user?.role || 'manager',
      },
    });

    await movement.save();
    const metrics = calculateStockMetrics(updatedItem.toObject());

    return res.status(200).json({
      stock: { ...updatedItem.toObject(), ...metrics },
      movement,
      message: `Successfully used ${qtyToDeduct} ${updatedItem.unit} of ${updatedItem.sku}.`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/stock/:id/adjust
 * Corrects physical stock count with mandatory explanation reason (Owner only).
 */
const adjustStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newQuantity, reason } = req.body || {};

    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      return res.status(422).json({
        error: {
          message: 'A mandatory adjustment reason of at least 5 characters is required.',
          code: 'REASON_REQUIRED',
        },
      });
    }

    const qtyCheck = validateStockQuantity(newQuantity, true);
    if (!qtyCheck.valid) {
      return res.status(422).json({
        error: { message: qtyCheck.error, code: 'INVALID_QUANTITY' },
      });
    }

    const item = await MaterialStock.findById(id);
    if (!item) {
      return res.status(404).json({
        error: { message: 'Material stock item not found', code: 'STOCK_NOT_FOUND' },
      });
    }

    const quantityBefore = Number(item.quantityOnHand);
    const quantityAfter = qtyCheck.value;
    const quantityDelta = Math.round((quantityAfter - quantityBefore) * 1000) / 1000;

    item.quantityOnHand = quantityAfter;
    await item.save();

    const movement = new MaterialMovement({
      material: item._id,
      sku: item.sku,
      type: 'ADJUST',
      quantityDelta,
      quantityBefore,
      quantityAfter,
      unit: item.unit,
      reason: reason.trim(),
      actor: {
        userId: req.user._id,
        name: req.user.name,
        role: req.user.role,
      },
    });

    await movement.save();
    const metrics = calculateStockMetrics(item.toObject());

    return res.status(200).json({
      stock: { ...item.toObject(), ...metrics },
      movement,
      message: `Stock count for ${item.sku} adjusted from ${quantityBefore} to ${quantityAfter} ${item.unit}.`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/stock/:id/mark-ordered
 * Flags a low/out stock item as ordered with supplier (Owner & Manager).
 */
const markOrdered = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { orderedQuantity, notes = '' } = req.body || {};

    const item = await MaterialStock.findById(id);
    if (!item) {
      return res.status(404).json({
        error: { message: 'Material stock item not found', code: 'STOCK_NOT_FOUND' },
      });
    }

    const qty = Number(orderedQuantity) || item.reorderLevel;
    item.isOrdered = true;
    item.orderedQuantity = qty;
    item.lastOrderedAt = new Date();
    await item.save();

    const metrics = calculateStockMetrics(item.toObject());

    return res.status(200).json({
      stock: { ...item.toObject(), ...metrics },
      message: `Reorder of ${qty} ${item.unit} for ${item.sku} marked as placed with supplier.`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/stock/:id/movements
 * Returns immutable movement ledger history for a specific material item.
 */
const getStockMovements = async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await MaterialStock.findById(id);
    if (!item) {
      return res.status(404).json({
        error: { message: 'Material stock item not found', code: 'STOCK_NOT_FOUND' },
      });
    }

    const movements = await MaterialMovement.find({ material: id }).sort('-timestamp').lean();

    return res.status(200).json({
      materialId: id,
      sku: item.sku,
      name: item.name,
      movements,
      total: movements.length,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStock,
  getStockSummary,
  createStock,
  updateStock,
  deleteStock,
  receiveStock,
  useStock,
  adjustStock,
  markOrdered,
  getStockMovements,
};
