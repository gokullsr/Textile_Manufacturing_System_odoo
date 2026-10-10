const express = require('express');
const {
  getStock,
  createStock,
  updateStock,
  deleteStock,
} = require('../controllers/stock.controller');

const router = express.Router();

router.get('/', getStock);
router.post('/', createStock);
router.patch('/:id', updateStock);
router.delete('/:id', deleteStock);

module.exports = router;
