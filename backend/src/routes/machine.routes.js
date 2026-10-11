const express = require('express');
const { getMachines } = require('../controllers/machine.controller');
const { requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/permissions');

const router = express.Router();

router.get('/', requirePermission(PERMISSIONS.READ_MACHINES), getMachines);

module.exports = router;
