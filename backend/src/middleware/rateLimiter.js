/**
 * Multi-dimensional Rate Limiting Middleware.
 * Tracks failed authentication attempts per IP and per normalized email.
 */
const { logSecurityEvent } = require('../utils/security');

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// In-memory buckets for tracking failed attempts
// Map key -> { count: number, resetAt: number }
const ipBuckets = new Map();
const emailBuckets = new Map();

/**
 * Periodically cleans up expired rate-limit entries.
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of ipBuckets.entries()) {
    if (now > bucket.resetAt) {
      ipBuckets.delete(key);
    }
  }
  for (const [key, bucket] of emailBuckets.entries()) {
    if (now > bucket.resetAt) {
      emailBuckets.delete(key);
    }
  }
}, 60 * 1000).unref();

/**
 * Checks whether an IP or email is currently rate-limited.
 * @param {string} ip
 * @param {string} email
 * @returns {{ limited: boolean, retryAfterSeconds: number }}
 */
const checkRateLimit = (ip, email = '') => {
  const now = Date.now();
  const normalizedEmail = email ? email.toLowerCase().trim() : '';

  // Check IP bucket
  if (ip && ipBuckets.has(ip)) {
    const bucket = ipBuckets.get(ip);
    if (now < bucket.resetAt && bucket.count >= MAX_FAILURES) {
      const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
      return { limited: true, retryAfterSeconds };
    }
  }

  // Check Email bucket
  if (normalizedEmail && emailBuckets.has(normalizedEmail)) {
    const bucket = emailBuckets.get(normalizedEmail);
    if (now < bucket.resetAt && bucket.count >= MAX_FAILURES) {
      const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
      return { limited: true, retryAfterSeconds };
    }
  }

  return { limited: false, retryAfterSeconds: 0 };
};

/**
 * Records an authentication failure for IP and email.
 * @param {string} ip
 * @param {string} email
 */
const recordFailure = (ip, email = '') => {
  const now = Date.now();
  const normalizedEmail = email ? email.toLowerCase().trim() : '';

  if (ip) {
    const bucket = ipBuckets.get(ip) || { count: 0, resetAt: now + WINDOW_MS };
    if (now > bucket.resetAt) {
      bucket.count = 1;
      bucket.resetAt = now + WINDOW_MS;
    } else {
      bucket.count += 1;
    }
    ipBuckets.set(ip, bucket);
  }

  if (normalizedEmail) {
    const bucket = emailBuckets.get(normalizedEmail) || { count: 0, resetAt: now + WINDOW_MS };
    if (now > bucket.resetAt) {
      bucket.count = 1;
      bucket.resetAt = now + WINDOW_MS;
    } else {
      bucket.count += 1;
    }
    emailBuckets.set(normalizedEmail, bucket);
  }
};

/**
 * Resets rate limit counters upon successful authentication.
 * @param {string} ip
 * @param {string} email
 */
const recordSuccess = (ip, email = '') => {
  const normalizedEmail = email ? email.toLowerCase().trim() : '';
  if (ip) ipBuckets.delete(ip);
  if (normalizedEmail) emailBuckets.delete(normalizedEmail);
};

/**
 * Express middleware for guarding login and auth endpoints.
 */
const authRateLimiter = (req, res, next) => {
  const email = req.body?.email || '';
  const ip = req.ip;

  const { limited, retryAfterSeconds } = checkRateLimit(ip, email);

  if (limited) {
    logSecurityEvent('AUTH_RATE_LIMITED', {
      ip,
      email: email ? email.toLowerCase().trim() : undefined,
      retryAfterSeconds,
      path: req.originalUrl,
    });

    res.setHeader('Retry-After', retryAfterSeconds);
    return res.status(429).json({
      error: {
        message: `Too many failed authentication attempts. Please try again in ${retryAfterSeconds} seconds.`,
        code: 'RATE_LIMITED',
      },
    });
  }

  next();
};

/**
 * Helper to clear all rate limit buckets (useful for test isolation).
 */
const resetAllBuckets = () => {
  ipBuckets.clear();
  emailBuckets.clear();
};

module.exports = {
  authRateLimiter,
  checkRateLimit,
  recordFailure,
  recordSuccess,
  resetAllBuckets,
  MAX_FAILURES,
  WINDOW_MS,
};
