/**
 * Authentication Controller.
 * Handles login, session lifecycle, password changes, and manager invitation acceptance.
 */
const { User, Session, Invitation } = require('../models');
const {
  validatePasswordPolicy,
  hashPassword,
  verifyPassword,
  performDummyHashCheck,
  generateOpaqueToken,
  hashToken,
  logSecurityEvent,
} = require('../utils/security');
const { getPermissionsForRole } = require('../utils/permissions');
const { setSessionCookie, clearSessionCookie, IDLE_TIMEOUT_MS, ABSOLUTE_TIMEOUT_MS } = require('../middleware/auth');
const { recordFailure, recordSuccess } = require('../middleware/rateLimiter');

/**
 * POST /api/auth/login
 * Authenticates user credentials, sets opaque session cookie, and returns user info + permissions.
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const ip = req.ip;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      recordFailure(ip, email);
      return res.status(401).json({
        error: {
          message: 'Invalid email or password.',
          code: 'INVALID_CREDENTIALS',
        },
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');

    if (!user) {
      await performDummyHashCheck(password);
      recordFailure(ip, normalizedEmail);
      logSecurityEvent('LOGIN_FAILED_UNKNOWN_EMAIL', { email: normalizedEmail, ip });

      return res.status(401).json({
        error: {
          message: 'Invalid email or password.',
          code: 'INVALID_CREDENTIALS',
        },
      });
    }

    if (!user.isActive) {
      await performDummyHashCheck(password);
      recordFailure(ip, normalizedEmail);
      logSecurityEvent('LOGIN_FAILED_INACTIVE_USER', { userId: user._id, email: normalizedEmail, ip });

      return res.status(401).json({
        error: {
          message: 'Invalid email or password.',
          code: 'INVALID_CREDENTIALS',
        },
      });
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);

    if (!isValidPassword) {
      recordFailure(ip, normalizedEmail);
      logSecurityEvent('LOGIN_FAILED_WRONG_PASSWORD', { userId: user._id, email: normalizedEmail, ip });

      return res.status(401).json({
        error: {
          message: 'Invalid email or password.',
          code: 'INVALID_CREDENTIALS',
        },
      });
    }

    // Authentication succeeded
    recordSuccess(ip, normalizedEmail);

    user.lastLoginAt = new Date();
    await user.save();

    // Create fresh session (rotate session on login)
    const rawToken = generateOpaqueToken();
    const tokenHash = hashToken(rawToken);
    const now = new Date();

    const session = new Session({
      tokenHash,
      user: user._id,
      lastSeenAt: now,
      expiresAt: new Date(now.getTime() + IDLE_TIMEOUT_MS),
      absoluteExpiresAt: new Date(now.getTime() + ABSOLUTE_TIMEOUT_MS),
      userAgent: req.headers['user-agent'] || '',
      ip,
    });

    await session.save();
    setSessionCookie(res, rawToken);

    logSecurityEvent('LOGIN_SUCCESS', { userId: user._id, email: normalizedEmail, role: user.role, ip });

    return res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      permissions: getPermissionsForRole(user.role),
      token: rawToken, // Provided for headless testing clients, browser uses cookie
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/logout
 * Deletes server-side session and clears client cookie.
 */
const logout = async (req, res, next) => {
  try {
    if (req.session) {
      await Session.deleteOne({ _id: req.session._id });
    }

    clearSessionCookie(res);

    if (req.user) {
      logSecurityEvent('LOGOUT', { userId: req.user._id, ip: req.ip });
    }

    return res.status(200).json({
      message: 'Logged out successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 * Returns the authenticated user profile and capability permissions.
 */
const getMe = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: {
          message: 'Authentication required. Please log in to continue.',
          code: 'UNAUTHENTICATED',
        },
      });
    }

    return res.status(200).json({
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        isActive: req.user.isActive,
      },
      permissions: req.permissions,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/change-password
 * Changes own password and ends all other active sessions.
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res.status(422).json({
        error: {
          message: 'Current password and new password are required.',
          code: 'VALIDATION_ERROR',
        },
      });
    }

    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!user) {
      return res.status(404).json({
        error: {
          message: 'User account not found.',
          code: 'USER_NOT_FOUND',
        },
      });
    }

    const isMatch = await verifyPassword(currentPassword, user.passwordHash);
    if (!isMatch) {
      logSecurityEvent('PASSWORD_CHANGE_FAILED_WRONG_CURRENT', { userId: user._id, ip: req.ip });
      return res.status(401).json({
        error: {
          message: 'Current password does not match.',
          code: 'INVALID_CREDENTIALS',
        },
      });
    }

    const policy = validatePasswordPolicy(newPassword, user.email);
    if (!policy.valid) {
      return res.status(422).json({
        error: {
          message: policy.error,
          code: 'WEAK_PASSWORD',
        },
      });
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    // Invalidate all other sessions for this user
    await Session.deleteMany({
      user: user._id,
      _id: { $ne: req.session._id },
    });

    logSecurityEvent('PASSWORD_CHANGED', { userId: user._id, ip: req.ip });

    return res.status(200).json({
      message: 'Password changed successfully. All other sessions have been logged out.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/invitations/:token
 * Public endpoint to validate an invitation link before rendering accept form.
 */
const getInvitation = async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        error: {
          message: 'Invalid invitation token format.',
          code: 'INVALID_INVITATION',
        },
      });
    }

    const tokenHash = hashToken(token);
    const invitation = await Invitation.findOne({ tokenHash });

    if (!invitation || invitation.usedAt || invitation.revokedAt || invitation.expiresAt < new Date()) {
      return res.status(404).json({
        error: {
          message: 'This invitation link is invalid, expired, or has already been used.',
          code: 'INVALID_INVITATION',
        },
      });
    }

    return res.status(200).json({
      invitation: {
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/accept-invite
 * Public endpoint for an invitee to set their name and password and onboard as manager.
 */
const acceptInvite = async (req, res, next) => {
  try {
    const { token, name, password } = req.body || {};

    if (!token || !name || !password) {
      return res.status(422).json({
        error: {
          message: 'Token, name, and password are required.',
          code: 'VALIDATION_ERROR',
        },
      });
    }

    if (name.trim().length < 2) {
      return res.status(422).json({
        error: {
          message: 'Name must be at least 2 characters long.',
          code: 'INVALID_NAME',
        },
      });
    }

    const tokenHash = hashToken(token);

    // Atomically claim the invitation (ensures single-use even with concurrent requests)
    const invitation = await Invitation.findOneAndUpdate(
      {
        tokenHash,
        usedAt: null,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      },
      {
        $set: { usedAt: new Date() },
      },
      { new: true }
    );

    if (!invitation) {
      return res.status(400).json({
        error: {
          message: 'This invitation has expired, been revoked, or was already used. Ask the owner for a new one.',
          code: 'INVALID_INVITATION',
        },
      });
    }

    const policy = validatePasswordPolicy(password, invitation.email);
    if (!policy.valid) {
      // Revert usedAt if validation fails so user can fix password without burning token
      invitation.usedAt = null;
      await invitation.save();

      return res.status(422).json({
        error: {
          message: policy.error,
          code: 'WEAK_PASSWORD',
        },
      });
    }

    // Ensure email is not already active
    const normalizedEmail = invitation.email.toLowerCase().trim();
    let user = await User.findOne({ email: normalizedEmail });

    const passwordHash = await hashPassword(password);

    if (user) {
      // Reactivate existing user account as manager
      user.name = name.trim();
      user.passwordHash = passwordHash;
      user.role = 'manager'; // Role is ALWAYS server-set to manager
      user.isActive = true;
      user.deactivatedAt = null;
      user.deactivatedBy = null;
      user.lastLoginAt = new Date();
      await user.save();
    } else {
      user = new User({
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: 'manager', // Role is ALWAYS server-set to manager
        isActive: true,
        createdBy: invitation.createdBy,
        lastLoginAt: new Date(),
      });
      await user.save();
    }

    invitation.usedBy = user._id;
    await invitation.save();

    // Create session
    const rawToken = generateOpaqueToken();
    const sessionTokenHash = hashToken(rawToken);
    const now = new Date();

    const session = new Session({
      tokenHash: sessionTokenHash,
      user: user._id,
      lastSeenAt: now,
      expiresAt: new Date(now.getTime() + IDLE_TIMEOUT_MS),
      absoluteExpiresAt: new Date(now.getTime() + ABSOLUTE_TIMEOUT_MS),
      userAgent: req.headers['user-agent'] || '',
      ip: req.ip,
    });

    await session.save();
    setSessionCookie(res, rawToken);

    logSecurityEvent('INVITATION_ACCEPTED', {
      userId: user._id,
      email: normalizedEmail,
      invitationId: invitation._id,
      ip: req.ip,
    });

    return res.status(201).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      permissions: getPermissionsForRole(user.role),
      token: rawToken,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  logout,
  getMe,
  changePassword,
  getInvitation,
  acceptInvite,
};
