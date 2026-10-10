/**
 * Health check route module.
 * Exposes system liveness and database connection status.
 */
const express = require('express');
const { getDbStatus } = require('../config/db');

const router = express.Router();

/**
 * GET /api/health
 * Returns service status, uptime, timestamp, and database connectivity.
 * Responds with HTTP 200 (ok) when healthy, or HTTP 503 (degraded) if database is not connected.
 */
router.get('/', (req, res) => {
  const dbStatus = getDbStatus();
  const isHealthy = dbStatus === 'connected';

  const healthPayload = {
    status: isHealthy ? 'ok' : 'degraded',
    service: 'loomiq-backend',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      status: dbStatus,
    },
  };

  const statusCode = isHealthy ? 200 : 503;
  return res.status(statusCode).json(healthPayload);
});

module.exports = router;
