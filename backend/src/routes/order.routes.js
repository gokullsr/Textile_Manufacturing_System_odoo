const express = require('express');
const {
  getOrders,
  getOrderByNumber,
  updateOrder,
  createOrder,
  deleteOrder,
} = require('../controllers/order.controller');

const router = express.Router();

router.get('/', getOrders);
router.post('/', createOrder);
router.get('/:orderNumber', getOrderByNumber);
router.patch('/:orderNumber', updateOrder);
router.delete('/:orderNumber', deleteOrder);

module.exports = router;
