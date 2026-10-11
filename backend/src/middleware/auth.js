/**
 * Authentication and Role-Based Authorization Middleware.
 * Enforces session verification, idle sliding window, default-deny security, and permission gates.
 */
const { Session, User } = require('../models');
const { hashToken, logSecurityEvent } = require('../utils/security');
const { getPermissionsForRole } = require('../utils/permissions');
const config = require('../config/env');

const IDLE_TIMEOUT_MS = parseInt(process.env.SESSION_IDLE_TIMEOUT_MS, 10) || 2 * 60 * 60 * 1000; // 2 hours
const ABSOLUTE_TIMEOUT_MS = parseInt(process.env.SESSION_ABSOLUTE_TIMEOUT_MS, 10) || 12 * 60 * 60 * 1000; // 12 hours

const getCookieName = () => {
  return config.nodeEnv === 'production' ? '__Host-loomiq_session' : 'loomiq_session';
};

/**
 * Sets session cookie on HTTP response.
 * @param {import('express').Response} res
 * @param {string} token - Raw opaque token
 */
const setSessionCookie = (res, token) => {
  const cookieName = getCookieName();
  const isProd = config.nodeEnv === 'production';

  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: ABSOLUTE_TIMEOUT_MS,
  });
};

/**
 * Clears session cookie on HTTP response.
 * @param {import('express').Response} res
 */
const clearSessionCookie = (res) => {
  const cookieName = getCookieName();
  res.clearCookie(cookieName, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
  });
  // Also clear the non-prefixed cookie in case environment switched
  res.clearCookie('loomiq_session', {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
  });
};

/**
 * Extracts raw session token from request cookies or Authorization header.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
const extractToken = (req) => {
  // Check cookies first
  const cookieName = getCookieName();
  if (req.cookies && req.cookies[cookieName]) {
    return req.cookies[cookieName];
  }
  if (req.cookies && req.cookies.loomiq_session) {
    return req.cookies.loomiq_session;
  }

  // Fallback to Bearer authorization header (useful for automated testing / CLI)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  return null;
};

/**
 * Session verification and user attachment middleware.
 */
const authenticateSession = async (req, res, next) => {
  try {
    const rawToken = extractToken(req);

    if (!rawToken) {
      req.user = null;
      req.session = null;
      req.permissions = [];
      return next();
    }

    const tokenHash = hashToken(rawToken);
    const session = await Session.findOne({ tokenHash }).populate('user');

    if (!session) {
      clearSessionCookie(res);
      req.user = null;
      req.session = null;
      req.permissions = [];
      return next();
    }

    const now = new Date();

    // Check absolute expiration
    if (now > session.absoluteExpiresAt) {
      await Session.deleteOne({ _id: session._id });
      clearSessionCookie(res);
      req.user = null;
      req.session = null;
      req.permissions = [];
      return next();
    }

    // Check idle expiration
    if (now > session.expiresAt) {
      await Session.deleteOne({ _id: session._id });
      clearSessionCookie(res);
      req.user = null;
      req.session = null;
      req.permissions = [];
      return next();
    }

    // Check user existence and active status
    if (!session.user || !session.user.isActive) {
      // Deactivated or missing user -> delete session immediately
      await Session.deleteOne({ _id: session._id });
      clearSessionCookie(res);
      req.user = null;
      req.session = null;
      req.permissions = [];
      return next();
    }

    // Extend idle expiration window (sliding window) up to absolute expiration
    const nextIdleExpiry = new Date(now.getTime() + IDLE_TIMEOUT_MS);
    session.lastSeenAt = now;
    session.expiresAt = nextIdleExpiry < session.absoluteExpiresAt ? nextIdleExpiry : session.absoluteExpiresAt;
    // Save updated session asynchronously
    session.save().catch((err) => console.error('[AUTH] Failed to touch session:', err));

    req.user = session.user;
    req.session = session;
    req.permissions = getPermissionsForRole(session.user.role);

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Default-Deny Guard.
 * Enforces that a valid authenticated session is present.
 */
const requireAuth = (req, res, next) => {
  if (!req.user || !req.session) {
    return res.status(401).json({
      error: {
        message: 'Authentication required. Please log in to continue.',
        code: 'UNAUTHENTICATED',
      },
    });
  }
  next();
};

/**
 * Enforces a specific capability permission for the current user.
 * @param {string} permission
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user || !req.session) {
      return res.status(401).json({
        error: {
          message: 'Authentication required. Please log in to continue.',
          code: 'UNAUTHENTICATED',
        },
      });
    }

    if (!req.permissions || !req.permissions.includes(permission)) {
      logSecurityEvent('UNAUTHORIZED_ACCESS_ATTEMPT', {
        userId: req.user._id,
        role: req.user.role,
        requiredPermission: permission,
        path: req.originalUrl,
        method: req.method,
        ip: req.ip,
      });

      return res.status(403).json({
        error: {
          message: 'You do not have permission to perform this action.',
          code: 'FORBIDDEN',
        },
      });
    }

    next();
  };
};

/**
 * Shorthand middleware for owner-only actions.
 */
const requireOwner = (req, res, next) => {
  if (!req.user || req.user.role !== 'owner') {
    logSecurityEvent('OWNER_PRIVILEGE_ATTEMPT', {
      userId: req.user?._id,
      role: req.user?.role,
      path: req.originalUrl,
      method: req.method,
      ip: req.ip,
    });

    return res.status(403).json({
      error: {
        message: 'This action is restricted to project owners.',
        code: 'FORBIDDEN',
      },
    });
  }
  next();
};

module.exports = {
  IDLE_TIMEOUT_MS,
  ABSOLUTE_TIMEOUT_MS,
  getCookieName,
  setSessionCookie,
  clearSessionCookie,
  authenticateSession,
  requireAuth,
  requirePermission,
  requireOwner,
};
