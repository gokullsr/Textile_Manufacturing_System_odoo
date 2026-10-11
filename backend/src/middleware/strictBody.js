/**
 * Strict Body Validation Middleware.
 * Rejects unknown or unwhitelisted payload fields to prevent mass-assignment attacks.
 */

/**
 * Creates middleware enforcing that req.body only contains allowed fields.
 * @param {string[]} allowedFields
 */
const whitelistBody = (allowedFields) => {
  const allowedSet = new Set(allowedFields);

  return (req, res, next) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return next();
    }

    const bodyKeys = Object.keys(req.body);
    const unknownKeys = bodyKeys.filter((key) => !allowedSet.has(key));

    if (unknownKeys.length > 0) {
      return res.status(422).json({
        error: {
          message: `Unknown or disallowed fields: ${unknownKeys.join(', ')}`,
          code: 'UNEXPECTED_FIELD',
        },
      });
    }

    next();
  };
};

module.exports = {
  whitelistBody,
};
