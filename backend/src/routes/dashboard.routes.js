const express = require('express');
const { getDashboardSummary } = require('../controllers/dashboard.controller');
const { requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/permissions');

const router = express.Router();

router.get('/summary', requirePermission(PERMISSIONS.READ_DASHBOARD), getDashboardSummary);

module.exports = router;
