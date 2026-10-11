/**
 * Cross-Site Request Forgery (CSRF) Protection Middleware.
 * Enforces Origin/Referer verification and Content-Type validation for state-changing HTTP methods.
 */
const config = require('../config/env');
const { logSecurityEvent } = require('../utils/security');

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Checks if a given origin/referer matches configured allowlists.
 * @param {string} sourceUrl
 * @returns {boolean}
 */
const isOriginAllowed = (sourceUrl) => {
  if (!sourceUrl) return false;

  try {
    const parsed = new URL(sourceUrl);
    const origin = parsed.origin.trim().replace(/\/+$/, '');
    const hostname = parsed.hostname;

    // 1. Check explicit CORS_ORIGINS
    const isExplicitlyAllowed = config.corsOrigins.some(
      (allowed) => allowed.trim().replace(/\/+$/, '') === origin
    );

    if (isExplicitlyAllowed) {
      return true;
    }

    // 2. In non-production or local LAN testing
    if (config.nodeEnv !== 'production') {
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        /^192\.168\.\d+\.\d+$/.test(hostname) ||
        /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(hostname) ||
        /^10\.\d+\.\d+\.\d+$/.test(hostname)
      ) {
        return true;
      }
    }

    return false;
  } catch (err) {
    return false;
  }
};

/**
 * CSRF Guard middleware.
 */
const csrfProtection = (req, res, next) => {
  // Safe HTTP methods pass through
  if (!STATE_CHANGING_METHODS.has(req.method)) {
    return next();
  }

  // Exempt health checks or unauthenticated webhooks if any
  if (req.path === '/api/health') {
    return next();
  }

  // 1. Origin / Referer check
  const originHeader = req.headers.origin;
  const refererHeader = req.headers.referer;
  const source = originHeader || refererHeader;

  // In standard browser operations on same-origin / cross-site requests, Origin or Referer is sent
  if (!source || !isOriginAllowed(source)) {
    logSecurityEvent('CSRF_BLOCKED', {
      method: req.method,
      path: req.originalUrl,
      origin: originHeader,
      referer: refererHeader,
      ip: req.ip,
    });

    return res.status(403).json({
      error: {
        message: 'Request blocked by CSRF security policy (unrecognized or missing Origin/Referer header).',
        code: 'CSRF_BLOCKED',
      },
    });
  }

  // 2. Content-Type check for requests with a payload
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  const isChunked = req.headers['transfer-encoding'] === 'chunked';
  const contentType = req.headers['content-type'] || '';

  if ((contentLength > 0 || isChunked) && !contentType.toLowerCase().includes('application/json')) {
    return res.status(403).json({
      error: {
        message: 'Request blocked: Content-Type must be application/json.',
        code: 'CSRF_BLOCKED',
      },
    });
  }

  next();
};

module.exports = csrfProtection;
