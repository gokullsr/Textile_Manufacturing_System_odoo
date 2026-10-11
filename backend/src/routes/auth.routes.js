/**
 * Authentication Routes.
 * Public and authenticated session endpoints.
 */
const express = require('express');
const authController = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth');
const { authRateLimiter } = require('../middleware/rateLimiter');
const { whitelistBody } = require('../middleware/strictBody');

const router = express.Router();

// Public auth endpoints with strict body whitelists and rate limits
router.post('/login', whitelistBody(['email', 'password']), authRateLimiter, authController.login);
router.get('/invitations/:token', authController.getInvitation);
router.post('/accept-invite', whitelistBody(['token', 'name', 'password', 'role']), authController.acceptInvite);

// Authenticated session endpoints
router.post('/logout', requireAuth, authController.logout);
router.get('/me', requireAuth, authController.getMe);
router.post(
  '/change-password',
  requireAuth,
  whitelistBody(['currentPassword', 'newPassword']),
  authController.changePassword
);

module.exports = router;
