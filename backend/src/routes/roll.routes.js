const express = require('express');
const {
  getRolls,
  createRoll,
  getRollByRollId,
  submitInspection,
  updateDispatchStatus,
} = require('../controllers/roll.controller');

const router = express.Router();

router.get('/', getRolls);
router.post('/', createRoll);
router.get('/:rollId', getRollByRollId);
router.patch('/:rollId/inspection', submitInspection);
router.patch('/:rollId/dispatch', updateDispatchStatus);

module.exports = router;
