/**
 * Delay Radar API Routes.
 * Protected read-only endpoints for factory delay risk assessment.
 */
const express = require('express');
const router = express.Router();
const delayRadarController = require('../controllers/delayRadar.controller');
const { requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/permissions');

// GET /api/delay-radar - Get active order assessments, summary, assumptions
router.get('/', requirePermission(PERMISSIONS.READ_RADAR), delayRadarController.getRadarAssessments);

// GET /api/delay-radar/:orderNumber - Get single order assessment trace
router.get('/:orderNumber', requirePermission(PERMISSIONS.READ_RADAR), delayRadarController.getOrderRadarAssessment);

module.exports = router;
