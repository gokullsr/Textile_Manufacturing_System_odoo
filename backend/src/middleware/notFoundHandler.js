/**
 * 404 Not Found Middleware.
 * Standardizes non-existent route responses across the API.
 */
const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    error: {
      message: `Route '${req.method} ${req.originalUrl}' not found`,
      code: 'NOT_FOUND',
    },
  });
};

module.exports = notFoundHandler;
