/**
 * Express application configuration.
 * Configures global middlewares, security headers, CORS allowlist, and route mounting.
 */
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config/env');
const healthRoutes = require('./routes/health.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const orderRoutes = require('./routes/order.routes');
const machineRoutes = require('./routes/machine.routes');
const stockRoutes = require('./routes/stock.routes');
const rollRoutes = require('./routes/roll.routes');
const delayRadarRoutes = require('./routes/delayRadar.routes');
const notFoundHandler = require('./middleware/notFoundHandler');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security headers
app.use(helmet());

// CORS configuration based on allowlist + local LAN subnets for QR scanning
const corsOptions = {
  origin: (origin, callback) => {
    // Allow server-to-server or non-browser requests
    if (!origin) return callback(null, true);
    
    const normalizedOrigin = origin.trim().replace(/\/+$/, '');
    
    // Check configured CORS origins
    const isExplicitlyAllowed = config.corsOrigins.some(
      (allowed) => allowed.trim().replace(/\/+$/, '') === normalizedOrigin
    );

    if (isExplicitlyAllowed) {
      return callback(null, true);
    }

    // In non-production or for local LAN testing from phones/tablets
    if (config.nodeEnv !== 'production') {
      try {
        const parsed = new URL(normalizedOrigin);
        const host = parsed.hostname;
        // Allow localhost, 127.0.0.1, and private IP ranges (192.168.x.x, 172.16-31.x.x, 10.x.x.x)
        if (
          host === 'localhost' ||
          host === '127.0.0.1' ||
          /^192\.168\.\d+\.\d+$/.test(host) ||
          /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(host) ||
          /^10\.\d+\.\d+\.\d+$/.test(host)
        ) {
          return callback(null, true);
        }
      } catch (e) {
        // Fall through
      }
    }
    
    return callback(new Error(`Origin '${origin}' not allowed by CORS policy`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

// JSON parser with explicit request size limit
app.use(express.json({ limit: '1mb' }));

// URL encoded body parser
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Route handlers
app.use('/api/health', healthRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/machines', machineRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/rolls', rollRoutes);
app.use('/api/delay-radar', delayRadarRoutes);

// Fallback 404 handler
app.use(notFoundHandler);

// Central error handler
app.use(errorHandler);

module.exports = app;
