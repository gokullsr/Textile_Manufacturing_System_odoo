const express = require('express');
const {
  getRolls,
  createRoll,
  getRollByRollId,
  previewInspection,
  submitInspection,
  advanceStage,
  updateDispatchStatus,
} = require('../controllers/roll.controller');
const { requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/permissions');

const router = express.Router();

router.get('/', requirePermission(PERMISSIONS.READ_ROLLS), getRolls);
router.post('/', requirePermission(PERMISSIONS.CREATE_ROLL), createRoll);
router.get('/:rollId', requirePermission(PERMISSIONS.READ_ROLLS), getRollByRollId);
router.post('/:rollId/inspection/preview', requirePermission(PERMISSIONS.INSPECT_ROLL), previewInspection);
router.patch('/:rollId/inspection', requirePermission(PERMISSIONS.INSPECT_ROLL), submitInspection);
router.post('/:rollId/advance', requirePermission(PERMISSIONS.CREATE_ROLL), advanceStage);
router.patch('/:rollId/dispatch', requirePermission(PERMISSIONS.DISPATCH_ROLL), updateDispatchStatus);

module.exports = router;
