/**
 * Database connection manager using Mongoose.
 * Provides resilient connection handling and real-time connection state mapping.
 */
const mongoose = require('mongoose');

// Map numeric readyState to human-readable strings
const READY_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

/**
 * Returns the current Mongoose database connection status string.
 */
const getDbStatus = () => {
  return READY_STATES[mongoose.connection.readyState] || 'disconnected';
};

/**
 * Connects to MongoDB using the provided URI.
 * Logs failures clearly without terminating the node process ungracefully.
 */
const connectDB = async (mongoUri) => {
  try {
    mongoose.set('strictQuery', true);
    
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000, // Timeout fast if server is unreachable
    });

    console.log(`[DB] Successfully connected to MongoDB database: ${mongoose.connection.name}`);
  } catch (error) {
    console.error(`[DB ERROR] Failed to connect to MongoDB: ${error.message}`);
    // We log the error clearly. The server continues running so /api/health can report degraded state.
  }
};

/**
 * Gracefully closes the database connection.
 */
const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    console.log('[DB] MongoDB connection gracefully closed.');
  }
};

module.exports = {
  connectDB,
  disconnectDB,
  getDbStatus,
};
