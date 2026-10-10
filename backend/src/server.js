/**
 * Server entry point.
 * Initializes database connection and boots HTTP listener with graceful shutdown handling.
 */
const app = require('./app');
const config = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');

let server;

const startServer = async () => {
  // Connect to database (fails gracefully if DB is offline, allowing health check to report degraded state)
  await connectDB(config.mongoUri);

  // Listen on 0.0.0.0 so that local network devices (smartphones, tablets) can access the API
  server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(` LoomIQ Backend Service running in ${config.nodeEnv} mode`);
    console.log(` Port: ${config.port} (bound to 0.0.0.0 for LAN access)`);
    console.log(` Health: http://localhost:${config.port}/api/health`);
    console.log(` Allowed CORS: ${config.corsOrigins.join(', ')} + Local Subnets`);
    console.log(`====================================================`);
  });
};

// Graceful shutdown handling
const shutdown = async (signal) => {
  console.log(`\n[SHUTDOWN] Received ${signal}. Starting graceful shutdown...`);
  
  if (server) {
    server.close(() => {
      console.log('[SHUTDOWN] HTTP server closed.');
    });
  }

  try {
    await disconnectDB();
    console.log('[SHUTDOWN] LoomIQ backend shut down cleanly.');
    process.exit(0);
  } catch (err) {
    console.error('[SHUTDOWN ERROR] Error during teardown:', err);
    process.exit(1);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

startServer();
