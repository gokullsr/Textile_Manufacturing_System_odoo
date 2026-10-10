/**
 * Stock Controller.
 * Queries raw materials, yarns, dyes, chemicals and computes live inventory shortfall metrics.
 */
const { MaterialStock } = require('../models');
const { calculateStockMetrics } = require('../utils/derivedMetrics');

/**
 * GET /api/stock
 * Returns all stock inventory with calculated stockLevel ('out' | 'low' | 'ok') and shortfall quantities.
 */
const getStock = async (req, res, next) => {
  try {
    const { level } = req.query;

    const items = await MaterialStock.find().sort('sku').lean();

    let stockList = items.map((item) => {
      const metrics = calculateStockMetrics(item);
      return {
        ...item,
        ...metrics,
      };
    });

    // Optional level filtering
    if (level === 'low') {
      stockList = stockList.filter((item) => item.stockLevel === 'low');
    } else if (level === 'out') {
      stockList = stockList.filter((item) => item.stockLevel === 'out');
    } else if (level === 'warning') {
      stockList = stockList.filter((item) => item.stockLevel === 'low' || item.stockLevel === 'out');
    }

    // Default sorting: out of stock first, then low stock with highest shortfall, then healthy stock
    stockList.sort((a, b) => {
      const priority = { out: 0, low: 1, ok: 2 };
      if (priority[a.stockLevel] !== priority[b.stockLevel]) {
        return priority[a.stockLevel] - priority[b.stockLevel];
      }
      return b.shortfall - a.shortfall;
    });

    return res.status(200).json({
      stock: stockList,
      total: stockList.length,
      outOfStockCount: stockList.filter((i) => i.stockLevel === 'out').length,
      lowStockCount: stockList.filter((i) => i.stockLevel === 'low').length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/stock
 * Creates a new material stock inventory item.
 */
const createStock = async (req, res, next) => {
  try {
    const { name, sku, quantityOnHand, unit = 'kg', reorderLevel = 100, supplier = '' } = req.body;

    if (!name || name.trim() === '') {
      return res.status(422).json({
        error: {
          message: 'Material name is required',
          code: 'MISSING_NAME',
        },
      });
    }

    if (!sku || sku.trim() === '') {
      return res.status(422).json({
        error: {
          message: 'Material SKU / Code is required',
          code: 'MISSING_SKU',
        },
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

    const qty = Number(quantityOnHand ?? 0);
    const reorder = Number(reorderLevel ?? 100);

    if (isNaN(qty) || qty < 0) {
      return res.status(422).json({
        error: {
          message: 'Quantity on hand must be a non-negative number',
          code: 'INVALID_QUANTITY',
        },
      });
    }

    if (isNaN(reorder) || reorder < 0) {
      return res.status(422).json({
        error: {
          message: 'Reorder level must be a non-negative number',
          code: 'INVALID_REORDER_LEVEL',
        },
      });
    }

    const item = new MaterialStock({
      name: name.trim(),
      sku: normalizedSku,
      quantityOnHand: qty,
      unit,
      reorderLevel: reorder,
      supplier: supplier.trim(),
    });

    await item.save();
    const metrics = calculateStockMetrics(item.toObject());

    return res.status(201).json({
      stock: {
        ...item.toObject(),
        ...metrics,
      },
      message: `Material ${item.sku} added to inventory.`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/stock/:id
 * Adjusts stock quantity, reorder level, or supplier details.
 */
const updateStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { quantityOnHand, reorderLevel, name, supplier } = req.body;

    const item = await MaterialStock.findById(id);
    if (!item) {
      return res.status(404).json({
        error: {
          message: 'Material stock item not found',
          code: 'STOCK_NOT_FOUND',
        },
      });
    }

    if (quantityOnHand !== undefined) {
      const qty = Number(quantityOnHand);
      if (isNaN(qty) || qty < 0) {
        return res.status(422).json({
          error: {
            message: 'Quantity on hand cannot be negative',
            code: 'INVALID_QUANTITY',
          },
        });
      }
      item.quantityOnHand = qty;
    }

    if (reorderLevel !== undefined) {
      const reorder = Number(reorderLevel);
      if (isNaN(reorder) || reorder < 0) {
        return res.status(422).json({
          error: {
            message: 'Reorder level cannot be negative',
            code: 'INVALID_REORDER_LEVEL',
          },
        });
      }
      item.reorderLevel = reorder;
    }

    if (name && name.trim()) {
      item.name = name.trim();
    }

    if (supplier !== undefined) {
      item.supplier = supplier.trim();
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
 * Deletes a material stock item from inventory.
 */
const deleteStock = async (req, res, next) => {
  try {
    const { id } = req.params;

    const item = await MaterialStock.findById(id);
    if (!item) {
      return res.status(404).json({
        error: {
          message: 'Material stock item not found',
          code: 'STOCK_NOT_FOUND',
        },
      });
    }

    await MaterialStock.deleteOne({ _id: item._id });

    return res.status(200).json({
      success: true,
      message: `Material ${item.sku} (${item.name}) successfully removed from stock.`,
      deletedId: id,
      deletedSku: item.sku,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStock,
  createStock,
  updateStock,
  deleteStock,
};
