/**
 * Environment configuration and startup validation.
 * Ensures all required environment variables are present before booting the app.
 */
const dotenv = require('dotenv');
const path = require('path');

// Load .env file from backend root if present
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const requiredEnvVars = ['MONGODB_URI'];
const missingVars = requiredEnvVars.filter((key) => !process.env[key]);

if (missingVars.length > 0) {
  console.error('====================================================');
  console.error('[FATAL] Missing required environment variables:');
  missingVars.forEach((v) => console.error(`  - ${v}`));
  console.error('Please configure them in backend/.env (refer to backend/.env.example)');
  console.error('====================================================');
  process.exit(1);
}

// Parse comma-separated CORS origins into an array of trimmed URLs (normalized without trailing slashes)
const parseCorsOrigins = (originsStr) => {
  if (!originsStr || originsStr.trim() === '') {
    return ['http://localhost:5173']; // Default Vite dev server port
  }
  return originsStr.split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean);
};

const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI,
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
};

module.exports = config;
