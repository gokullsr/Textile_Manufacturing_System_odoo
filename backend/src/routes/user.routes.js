/**
 * Team Management Routes.
 * Owner-restricted endpoints for listing and deactivating team members.
 */
const express = require('express');
const userController = require('../controllers/user.controller');
const { requireAuth, requireOwner } = require('../middleware/auth');
const { whitelistBody } = require('../middleware/strictBody');

const router = express.Router();

router.use(requireAuth);
router.use(requireOwner);

router.get('/', userController.getUsers);
router.patch('/:id', whitelistBody(['isActive']), userController.updateUser);

module.exports = router;
