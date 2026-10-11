const express = require('express');
const {
  getQualityConfig,
  getQualitySummary,
  getQualityAlerts,
  getCorrectiveActions,
  createCorrectiveAction,
  getCorrectiveActionByNumber,
  updateCorrectiveAction,
} = require('../controllers/quality.controller');
const { requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/permissions');

const router = express.Router();

// Quality Control Tower & Config
router.get('/config', requirePermission(PERMISSIONS.READ_QUALITY), getQualityConfig);
router.get('/summary', requirePermission(PERMISSIONS.READ_QUALITY), getQualitySummary);
router.get('/alerts', requirePermission(PERMISSIONS.READ_QUALITY), getQualityAlerts);

// Corrective Actions (CAPA)
router.get('/actions', requirePermission(PERMISSIONS.READ_QUALITY), getCorrectiveActions);
router.post('/actions', requirePermission(PERMISSIONS.MANAGE_CAPA), createCorrectiveAction);
router.get('/actions/:actionNumber', requirePermission(PERMISSIONS.READ_QUALITY), getCorrectiveActionByNumber);
router.patch('/actions/:actionNumber', requirePermission(PERMISSIONS.MANAGE_CAPA), updateCorrectiveAction);

module.exports = router;
