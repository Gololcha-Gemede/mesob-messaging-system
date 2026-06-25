const dotenv = require('dotenv');
const path = require('path');

const projectEnv = path.resolve(__dirname, '..', '..', '.env');
const serverEnv = path.resolve(__dirname, '..', '.env');

dotenv.config({ path: projectEnv });
dotenv.config({ path: serverEnv });

function getEnv(name, fallback = '') {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

function requireEnv(names) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
      'Copy .env.example to .env and fill in the required values.'
    );
  }
}

module.exports = {
  getEnv,
  requireEnv
};
