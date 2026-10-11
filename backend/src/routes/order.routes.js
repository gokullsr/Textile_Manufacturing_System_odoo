const express = require('express');
const {
  getOrders,
  getOrderByNumber,
  updateOrder,
  createOrder,
  deleteOrder,
} = require('../controllers/order.controller');
const { requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/permissions');

const router = express.Router();

router.get('/', requirePermission(PERMISSIONS.READ_ORDERS), getOrders);
router.post('/', requirePermission(PERMISSIONS.UPDATE_ORDER), createOrder);
router.get('/:orderNumber', requirePermission(PERMISSIONS.READ_ORDERS), getOrderByNumber);
router.patch('/:orderNumber', requirePermission(PERMISSIONS.UPDATE_ORDER), updateOrder);
router.delete('/:orderNumber', requirePermission(PERMISSIONS.UPDATE_ORDER), deleteOrder);

module.exports = router;
