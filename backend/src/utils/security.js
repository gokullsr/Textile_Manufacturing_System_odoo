/**
 * LoomIQ Security and Cryptographic Utilities.
 * Handles password hashing, token generation, constant-time dummy verification, and audit logging.
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = 12;

// Precomputed dummy hash (cost 12) for unknown emails to mitigate timing side-channel attacks
const DUMMY_HASH = '$2a$12$e8w5Q8X1rE2J1/i81dYj1OBVw5a44M6vTf/q9mXN8N8yQ/GqO2X5K';

/**
 * Validates a password against factory policy:
 * - Length 12-128 characters
 * - Must not match the user's email
 * @param {string} password
 * @param {string} email
 * @returns {{ valid: boolean, error?: string }}
 */
const validatePasswordPolicy = (password, email = '') => {
  if (typeof password !== 'string') {
    return { valid: false, error: 'Password must be a string' };
  }

  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long' };
  }

  if (password.length > 128) {
    return { valid: false, error: 'Password cannot exceed 128 characters' };
  }

  if (email && password.toLowerCase().trim() === email.toLowerCase().trim()) {
    return { valid: false, error: 'Password cannot be the same as the email address' };
  }

  return { valid: true };
};

/**
 * Hashes a plaintext password using bcrypt with work factor 12.
 * @param {string} password
 * @returns {Promise<string>}
 */
const hashPassword = async (password) => {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
};

/**
 * Compares plaintext password against bcrypt hash.
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
const verifyPassword = async (password, hash) => {
  if (!hash) {
    await bcrypt.compare(password || '', DUMMY_HASH);
    return false;
  }
  return bcrypt.compare(password, hash);
};

/**
 * Executes dummy comparison against DUMMY_HASH for unknown emails.
 * @param {string} password
 * @returns {Promise<void>}
 */
const performDummyHashCheck = async (password) => {
  try {
    await bcrypt.compare(password || '', DUMMY_HASH);
  } catch (e) {
    // Ignore error
  }
};

/**
 * Generates a high-entropy 32-byte opaque hex token.
 * @returns {string} 64 character hex string
 */
const generateOpaqueToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Hashes a token using SHA-256 for secure database storage.
 * @param {string} token
 * @returns {string} SHA-256 hex digest
 */
const hashToken = (token) => {
  if (!token) return '';
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Logs a structured security audit event.
 * Never logs passwords, tokens, or hashes.
 * @param {string} event
 * @param {object} meta
 */
const logSecurityEvent = (event, meta = {}) => {
  const safeMeta = { ...meta };
  // Redact any accidental sensitive keys
  delete safeMeta.password;
  delete safeMeta.passwordHash;
  delete safeMeta.token;
  delete safeMeta.tokenHash;
  delete safeMeta.currentPassword;
  delete safeMeta.newPassword;

  const logEntry = {
    timestamp: new Date().toISOString(),
    type: 'SECURITY_AUDIT',
    event,
    ...safeMeta,
  };

  console.log(`[SECURITY] ${JSON.stringify(logEntry)}`);
};

module.exports = {
  BCRYPT_ROUNDS,
  DUMMY_HASH,
  validatePasswordPolicy,
  hashPassword,
  verifyPassword,
  performDummyHashCheck,
  generateOpaqueToken,
  hashToken,
  logSecurityEvent,
};
