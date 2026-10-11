const express = require('express');
const {
  getCorrectiveActions,
  createCorrectiveAction,
  getCorrectiveActionByNumber,
  updateCorrectiveAction,
} = require('../controllers/quality.controller');
const { requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/permissions');

const router = express.Router();

router.get('/', requirePermission(PERMISSIONS.READ_QUALITY), getCorrectiveActions);
router.post('/', requirePermission(PERMISSIONS.MANAGE_CAPA), createCorrectiveAction);
router.get('/:actionNumber', requirePermission(PERMISSIONS.READ_QUALITY), getCorrectiveActionByNumber);
router.patch('/:actionNumber', requirePermission(PERMISSIONS.MANAGE_CAPA), updateCorrectiveAction);
router.patch('/:actionNumber/status', requirePermission(PERMISSIONS.MANAGE_CAPA), updateCorrectiveAction);

module.exports = router;
