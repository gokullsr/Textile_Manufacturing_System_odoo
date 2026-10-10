const express = require('express');
const { getMachines } = require('../controllers/machine.controller');

const router = express.Router();

router.get('/', getMachines);

module.exports = router;
