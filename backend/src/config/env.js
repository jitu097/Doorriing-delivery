const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 5000,
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || '',
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
  CORS_ORIGINS: process.env.CORS_ORIGINS || '*',
  // Temporary test credentials (remove before production)
  TEMP_ADMIN_EMAIL:       process.env.TEMP_ADMIN_EMAIL       || '',
  TEMP_ADMIN_PASSWORD:    process.env.TEMP_ADMIN_PASSWORD    || '',
  TEMP_DELIVERY_EMAIL:    process.env.TEMP_DELIVERY_EMAIL    || '',
  TEMP_DELIVERY_PASSWORD: process.env.TEMP_DELIVERY_PASSWORD || ''
};

module.exports = { env };
