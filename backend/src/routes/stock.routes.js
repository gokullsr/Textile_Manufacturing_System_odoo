const express = require('express');
const {
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
} = require('../controllers/stock.controller');
const { requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/permissions');

const router = express.Router();

// Summaries & Catalog Reads
router.get('/summary', requirePermission(PERMISSIONS.READ_STOCK), getStockSummary);
router.get('/', requirePermission(PERMISSIONS.READ_STOCK), getStock);
router.get('/:id/movements', requirePermission(PERMISSIONS.READ_STOCK), getStockMovements);

// Operational Stock Movements (Owner & Manager)
router.post('/:id/receive', requirePermission(PERMISSIONS.STOCK_RECEIVE), receiveStock);
router.post('/:id/use', requirePermission(PERMISSIONS.STOCK_USE), useStock);
router.post('/:id/mark-ordered', requirePermission(PERMISSIONS.STOCK_ORDER), markOrdered);

// Administrative Stock Management & Physical Adjustments (Owner only)
router.post('/', requirePermission(PERMISSIONS.STOCK_MANAGE), createStock);
router.patch('/:id', requirePermission(PERMISSIONS.STOCK_MANAGE), updateStock);
router.delete('/:id', requirePermission(PERMISSIONS.STOCK_MANAGE), deleteStock);
router.post('/:id/adjust', requirePermission(PERMISSIONS.STOCK_ADJUST), adjustStock);

module.exports = router;
