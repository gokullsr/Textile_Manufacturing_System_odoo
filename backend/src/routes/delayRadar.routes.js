/**
 * Delay Radar API Routes.
 * Read-only endpoints for factory delay risk assessment.
 */
const express = require('express');
const router = express.Router();
const delayRadarController = require('../controllers/delayRadar.controller');

// GET /api/delay-radar - Get active order assessments, summary, assumptions
router.get('/', delayRadarController.getRadarAssessments);

// GET /api/delay-radar/:orderNumber - Get single order assessment trace
router.get('/:orderNumber', delayRadarController.getOrderRadarAssessment);

module.exports = router;
