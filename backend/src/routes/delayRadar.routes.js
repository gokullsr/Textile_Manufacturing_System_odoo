const express = require('express');
const router = express.Router();
const delayRadarController = require('../controllers/delayRadar.controller');

router.get('/', delayRadarController.getRadarAssessments);

router.get('/:orderNumber', delayRadarController.getOrderRadarAssessment);

module.exports = router;
