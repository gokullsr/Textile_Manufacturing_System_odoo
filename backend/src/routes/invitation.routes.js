/**
 * Invitation Management Routes.
 * Owner-restricted endpoints for creating, listing, and revoking onboarding invitations.
 */
const express = require('express');
const userController = require('../controllers/user.controller');
const { requireAuth, requireOwner } = require('../middleware/auth');
const { whitelistBody } = require('../middleware/strictBody');

const router = express.Router();

router.use(requireAuth);
router.use(requireOwner);

router.get('/', userController.getInvitations);
router.post('/', whitelistBody(['email']), userController.createInvitation);
router.delete('/:id', userController.revokeInvitation);

module.exports = router;
